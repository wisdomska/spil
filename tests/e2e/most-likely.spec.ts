import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, lockIn, phone } from "./harness";

// Most Likely To: three phones vote in secret; the reveal names the room's pick.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

async function voteAll(page: Page, name: string) {
  for (let i = 0; i < 5; i++) {
    const group = page.getByRole("radiogroup", { name: new RegExp(`^Prompt ${i + 1} of 5\\.`) });
    await expect(group).toBeVisible({ timeout: 15_000 });
    await expect(group.getByRole("radio")).toHaveCount(2);
    await group.getByRole("radio", { name: new RegExp(name) }).click();
    await lockIn(page);
  }
}

test("three players vote and see who the room picked", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "Most Likely To",
    count: 5,
    nickname: "Senya",
    mode: "Most Likely To",
  });
  await expect(host.page.getByRole("region", { name: "Game setup" })).toContainText(
    "Most Likely To",
  );
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  // Ama gets 2 votes on every prompt (Senya, Kofi); Kofi gets Ama's.
  await expect(host.page.getByText("Who's most likely to")).toBeVisible({ timeout: 15_000 });
  await Promise.all([voteAll(host.page, "Ama"), voteAll(g1.page, "Kofi"), voteAll(g2.page, "Ama")]);

  // No guessing: Lights down straight away.
  await host.page.getByRole("button", { name: "Start the reveal" }).click({ timeout: 20_000 });
  await expect(host.page.getByText("PROMPT 1 OF 5")).toBeVisible();
  await expect(host.page.getByText("2 of 3 votes", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(host.page.getByText("1 vote", { exact: true })).toBeVisible({ timeout: 8000 });

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(g1.page.getByText("THE ROOM SAYS YOU'RE MOST LIKELY TO")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    g1.page.getByText(/^2 of 3 votes\. You voted with the room for 0 points\.$/),
  ).toBeVisible();
  await expect(host.page.getByText(/You voted with the room for 50 points\./)).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Share my card" })).toHaveCount(0);
  for (const p of [host, g1, g2]) await p.context.close();
});
