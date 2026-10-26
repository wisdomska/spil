import { expect, test } from "@playwright/test";
import { answerAll, createRoom, guess, joinRoom, lockIn, phone } from "./harness";

// Room Percentage: three phones answer, then guess what share of the room said yes.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("three players read the room and see each question's share", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  await host.page.goto("/create");
  const code = await createRoom(host.page, {
    pack: "classic",
    count: 5,
    nickname: "Senya",
    mode: "Room Percentage",
  });
  await expect(host.page.getByRole("region", { name: "Game setup" })).toContainText(
    "Room Percentage",
  );
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await expect(host.page.getByRole("button", { name: "Start the game" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  await Promise.all([
    answerAll(host.page, "YYYYY"),
    answerAll(g1.page, "YYNNN"),
    answerAll(g2.page, "NNNNN"),
  ]);

  // Real shares: 67, 67, 33, 33, 33. The host guesses them exactly.
  const shares = [67, 67, 33, 33, 33];
  const guessAllPercent = async (page: typeof host.page, value: (i: number) => number) => {
    await expect(page.getByText("What share of the room said yes?")).toBeVisible({
      timeout: 15_000,
    });
    for (let i = 0; i < 5; i++) {
      await expect(page.getByText(`Question ${i + 1} of 5`)).toBeVisible();
      await guess(page, value(i));
      await lockIn(page);
    }
  };
  await Promise.all([
    guessAllPercent(host.page, (i) => shares[i]!),
    guessAllPercent(g1.page, () => 50),
    guessAllPercent(g2.page, () => 10),
  ]);

  await host.page.getByRole("button", { name: "Start the reveal" }).click();
  await expect(host.page.getByText("QUESTION 1 OF 5")).toBeVisible();
  await expect(host.page.getByText("67% said yes")).toBeVisible({ timeout: 8000 });
  await expect(host.page.getByText("Bullseye")).toBeVisible();
  await expect(g1.page.getByText("67% said yes")).toBeVisible({ timeout: 8000 });

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(
    host.page.getByText(/^You scored 100\. You read the room for 65 points\.$/),
  ).toBeVisible({
    timeout: 15_000,
  });
  for (const p of [host, g1, g2]) await p.context.close();
});
