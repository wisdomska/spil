import { expect, test } from "@playwright/test";
import { answerAll, apiPlayer, guessAll, hostRoom, joinRoom, newPlayer } from "./helpers";

test.describe.configure({ mode: "serial" });

test("full game with 3 players on separate phones, then results, share card and privacy @cross", async ({
  browser,
  baseURL,
}) => {
  const host = await newPlayer(browser, "Ama");
  const kofi = await newPlayer(browser, "Kofi");
  const efua = await newPlayer(browser, "Efua");

  const code = await hostRoom(host, { pack: "Classic", count: 5 });
  await joinRoom(kofi, code);
  await joinRoom(efua, code);

  // Lobby drops players in on the host's screen via realtime or polling.
  await expect(host.page.getByText("3 in. Everyone ready?")).toBeVisible();
  await host.page.getByRole("button", { name: "Start the game" }).click();

  await answerAll(host.page, () => "y");
  await answerAll(kofi.page, (i) => (i < 2 ? "y" : "n"));
  await expect(host.page.getByText(/Waiting on Efua\. Typical\./)).toBeVisible();
  await answerAll(efua.page, () => "n");

  for (const p of [host, kofi, efua]) await guessAll(p.page, (i) => 30 + i * 20);

  await expect(host.page.getByRole("heading", { name: /Lights down/ })).toBeVisible();
  await expect(kofi.page.getByText("Eyes on Ama. The reveal starts any second.")).toBeVisible();
  await host.page.getByRole("button", { name: "Start the reveal" }).click();

  // Every phone shows the same slide; the host paces it and may skip to the results (SPIL-11).
  await Promise.all(
    [host, kofi, efua].map((p) => expect(p.page.getByText(/REVEAL 1 OF \d/)).toBeVisible()),
  );
  await expect(kofi.page.getByText("Waiting for Ama…")).toBeVisible();
  await host.page.getByRole("button", { name: "Skip" }).click();
  for (const p of [host, kofi, efua])
    await expect(p.page.getByRole("heading", { name: /You('re|'ve) / })).toBeVisible({
      timeout: 30_000,
    });
  await expect(host.page.getByText(/^You scored 100./)).toBeVisible();
  // The best guesser wins the round; the list leads with Mind Reader points (SPIL-09).
  await expect(
    host.page.getByText(/(won|tied for) the win|won the round with \d+ Mind Reader points\./),
  ).toBeVisible();
  await expect(host.page.getByRole("listitem").first()).toContainText("Mind Reader");

  // Privacy: other players' answers are not readable through the API (no Spill Mode).
  const outsider = await apiPlayer(baseURL!, "Spy");
  await expect(outsider.call("GET", `/rooms/${code}/state`)).rejects.toThrow(/403/);

  // Spill Mode names only opted-in players in question stats.
  await kofi.page.getByRole("switch", { name: /Spill Mode/ }).click();
  await efua.page.getByRole("tab", { name: "Questions" }).click();
  await expect(
    efua.page.getByText(/Spill Mode yes: Kofi|Nobody in Spill Mode said yes/).first(),
  ).toBeVisible();
  // Ama never switched Spill Mode on: no "Spill Mode yes" line may name her.
  const named = await efua.page.getByText(/^Spill Mode yes:/).allInnerTexts();
  const lines = named.map((t) => t.split("\n")[0] ?? "");
  expect(lines.filter((t) => /\bAma\b/.test(t))).toEqual([]);

  // Share card: a real 1080x1920 PNG is produced.
  await host.page.getByRole("button", { name: "Share my card" }).click();
  const download = host.page.waitForEvent("download");
  await host.page.getByRole("button", { name: "Save image" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`spil-${code}-story.png`);

  for (const p of [host, kofi, efua]) await p.context.close();
});

test("rooms of 7 and 12 players finish and give six awards", async ({ browser, baseURL }) => {
  for (const size of [7, 12]) {
    const host = await newPlayer(browser, "Host");
    const code = await hostRoom(host, { pack: "Classic", count: 5 });
    const others = await Promise.all(
      Array.from({ length: size - 1 }, (_, i) => apiPlayer(baseURL!, `Player ${i + 2}`)),
    );
    for (const o of others) await o.join(code);
    await expect(host.page.getByText(`${size} in. Everyone ready?`)).toBeVisible();
    await host.page.getByRole("button", { name: "Start the game" }).click();
    for (const [i, o] of others.entries()) await o.answerAll(code, (i % 3) + 1);
    await answerAll(host.page, (i) => (i % 2 ? "y" : "n"));
    for (const o of others) await o.guessAll(code, 40);
    await guessAll(host.page, () => 50);
    await host.page.getByRole("button", { name: "Start the reveal" }).click();
    await host.page.getByRole("button", { name: "Skip" }).click();
    await host.page.getByRole("tab", { name: "Awards" }).click();
    for (const award of [
      "Top Spiller",
      "Saint of the Room",
      "Mind Reader",
      "Dark Horse",
      "Open Book",
      "Clueless",
    ])
      await expect(host.page.getByText(award, { exact: true }).first()).toBeVisible();
    await host.context.close();
  }
});

test("host forces the next phase; a slow player sits out but can still guess", async ({
  browser,
  baseURL,
}) => {
  const host = await newPlayer(browser, "Ama");
  const code = await hostRoom(host, { pack: "Classic", count: 5 });
  const fast = await apiPlayer(baseURL!, "Kofi");
  const slow = await apiPlayer(baseURL!, "Yaw");
  await fast.join(code);
  await slow.join(code);
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await fast.answerAll(code);
  await answerAll(host.page, () => "y");
  await expect(host.page.getByRole("button", { name: "Move on without them" })).toBeVisible();
  await host.page.getByRole("button", { name: "Move on without them" }).click();
  await expect(host.page.getByRole("dialog")).toContainText("Yaw");
  await host.page.getByRole("dialog").getByRole("button", { name: "Move on without them" }).click();
  await expect(host.page.getByText(/^Guess 1 of 1$/)).toBeVisible();
  await host.context.close();
});

test("host leaves the lobby and the next player takes over", async ({ browser }) => {
  const host = await newPlayer(browser, "Ama");
  const guest = await newPlayer(browser, "Kofi");
  const code = await hostRoom(host, { pack: "Classic" });
  await joinRoom(guest, code);
  await host.page.getByRole("button", { name: "Leave room" }).first().click();
  await host.page.getByRole("dialog").getByRole("button", { name: "Leave room" }).click();
  await host.page.waitForURL(/\/$/);
  // Alone in the room, the new host is offered solo play.
  await expect(guest.page.getByRole("button", { name: "Play solo" })).toBeVisible({
    timeout: 40_000,
  });
  await host.context.close();
  await guest.context.close();
});

test("offline answers queue on the phone and send when back online", async ({
  browser,
  baseURL,
}) => {
  const host = await newPlayer(browser, "Ama");
  const code = await hostRoom(host, { pack: "Classic", count: 5 });
  for (const n of ["Kofi", "Efua"]) await apiPlayer(baseURL!, n).then((p) => p.join(code));
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await expect(host.page.getByRole("group", { name: /^Question 1 of 5/ })).toBeVisible();
  await host.context.setOffline(true);
  await host.page.keyboard.press("y");
  await host.page.keyboard.press("n");
  await expect(host.page.getByText(/You're offline/)).toBeVisible();
  await expect(host.page.getByText("Queued")).toBeVisible();
  await host.context.setOffline(false);
  await expect(host.page.getByText("Queued")).toBeHidden({ timeout: 40_000 });
  // The two answers reach the server ("Queued" goes away as soon as sending starts).
  await expect
    .poll(
      async () => {
        const state = await host.page.evaluate(
          async (c) => (await fetch(`/api/v1/rooms/${c}/state`)).json(),
          code,
        );
        return Object.keys(state.myAnswers ?? {}).length;
      },
      { timeout: 20_000 },
    )
    .toBe(2);
  await host.context.close();
});

test("rematch keeps the code, switches pack and starts a fresh round", async ({
  browser,
  baseURL,
}) => {
  const host = await newPlayer(browser, "Ama");
  const code = await hostRoom(host, { pack: "Classic", count: 5 });
  const others = [await apiPlayer(baseURL!, "Kofi"), await apiPlayer(baseURL!, "Efua")];
  for (const o of others) await o.join(code);
  await host.page.getByRole("button", { name: "Start the game" }).click();
  for (const o of others) await o.answerAll(code);
  await answerAll(host.page, () => "y");
  for (const o of others) await o.guessAll(code);
  await guessAll(host.page, () => 50);
  await host.page.getByRole("button", { name: "Start the reveal" }).click();
  await host.page.getByRole("button", { name: "Skip" }).click();
  await host.page.getByRole("link", { name: "Change game or pack" }).click();
  await host.page.getByRole("button", { name: /^Spill Score/ }).click();
  await host.page.getByRole("radio", { name: /Campus Life/ }).click();
  await host.page.getByRole("button", { name: /Continue with Campus Life/ }).click();
  await host.page.waitForURL(new RegExp(`/r/${code}$`));
  await expect(host.page.getByRole("region", { name: "Game setup" })).toContainText("Campus Life");
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await expect(host.page.getByRole("group", { name: /^Question 1 of/ })).toBeVisible();
  await host.context.close();
});
