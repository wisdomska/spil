import { expect, test, type Page } from "@playwright/test";
import { createRoom, guess, joinRoom, lockIn, phone } from "./harness";

// Imposter: three phones answer; one secret player had different questions; the room votes.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function answerAll(page: Page) {
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`${i + 1}/5`, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await guess(page, 60);
    await lockIn(page);
  }
}

test("the room votes out the player who had different questions", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "Imposter",
    count: 5,
    nickname: "Senya",
    mode: "Imposter",
  });
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  // Find the imposter the way players would: the phone whose first question differs.
  const phones = [
    { page: host.page, name: "Senya" },
    { page: g1.page, name: "Ama" },
    { page: g2.page, name: "Kofi" },
  ];
  for (const p of phones)
    await expect(
      p.page.getByText("In this game the room sees everyone's answers.", { exact: false }),
    ).toBeVisible({
      timeout: 15_000,
    });
  const firsts = await Promise.all(
    phones.map((p) => p.page.getByRole("heading", { level: 1 }).innerText()),
  );
  const odd = firsts.findIndex((t) => firsts.filter((x) => x === t).length === 1);
  expect(odd).toBeGreaterThanOrEqual(0);
  const imposter = phones[odd]!;
  const crew = phones.filter((_, i) => i !== odd);

  await Promise.all(phones.map((p) => answerAll(p.page)));

  // Everyone sees the real questions and the numbers, then votes.
  for (const p of phones)
    await expect(p.page.getByText("Find the imposter.")).toBeVisible({ timeout: 15_000 });
  await expect(crew[0]!.page.getByText(firsts[odd]!)).toHaveCount(0);
  for (const c of crew) {
    await c.page.getByRole("radio", { name: new RegExp(imposter.name) }).click();
    await c.page.getByRole("button", { name: "Lock in my vote" }).click();
  }
  await imposter.page.getByRole("radio", { name: new RegExp(crew[0]!.name) }).click();
  await imposter.page.getByRole("button", { name: "Lock in my vote" }).click();

  await host.page.getByRole("button", { name: "Start the reveal" }).click({ timeout: 20_000 });
  await expect(host.page.getByText("THE ROOM VOTED FOR", { exact: true })).toBeVisible();
  await expect(host.page.getByText("2 of 3 votes")).toBeVisible({ timeout: 8000 });

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(imposter.page.getByText("YOU WERE THE IMPOSTER")).toBeVisible({ timeout: 15_000 });
  await expect(imposter.page.getByText("The room caught you.")).toBeVisible();
  await expect(crew[0]!.page.getByText(/You voted right for 10 points\./)).toBeVisible({
    timeout: 15_000,
  });
  for (const p of [host, g1, g2]) await p.context.close();
});
