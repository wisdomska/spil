import { expect, test, type Page } from "@playwright/test";
import { createRoom, joinRoom, lockIn, phone } from "./harness";

// Rank the Room: three phones put the room in order; the reveal shows the room's order.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

/** Puts the list in this order with the up arrows: each name, last first, goes to the top. */
async function arrange(page: Page, order: string[]) {
  for (const name of [...order].reverse()) {
    const up = page.getByRole("button", { name: `Move ${name} up` });
    while (await up.isEnabled()) await up.click();
  }
}

async function rankAll(page: Page, order: string[]) {
  for (let i = 0; i < 5; i++) {
    await expect(
      page.getByRole("list", { name: new RegExp(`^Prompt ${i + 1} of 5\\.`) }),
    ).toBeVisible({ timeout: 15_000 });
    await arrange(page, order);
    await lockIn(page);
  }
}

test("three players rank the room and see its order", async ({ browser }) => {
  const host = await phone(browser, "guest");
  const g1 = await phone(browser, "guest");
  const g2 = await phone(browser, "guest");
  const code = await createRoom(host.page, {
    pack: "Most Likely To",
    count: 5,
    nickname: "Senya",
    mode: "Rank the Room",
  });
  await joinRoom(g1.page, code, { nickname: "Ama" });
  await joinRoom(g2.page, code, { nickname: "Kofi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();

  await expect(host.page.getByText("Rank the room: most likely to")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    host.page.getByRole("list", { name: /^Prompt 1 of 5\./ }).getByText("Senya (you)"),
  ).toBeVisible();
  // Senya and Ama: Senya, Ama, Kofi. Kofi: Kofi, Ama, Senya. Room: Senya, Ama, Kofi.
  await Promise.all([
    rankAll(host.page, ["Senya", "Ama", "Kofi"]),
    rankAll(g1.page, ["Senya", "Ama", "Kofi"]),
    rankAll(g2.page, ["Kofi", "Ama", "Senya"]),
  ]);

  await host.page.getByRole("button", { name: "Start the reveal" }).click({ timeout: 20_000 });
  await expect(host.page.getByText("PROMPT 1 OF 5")).toBeVisible();
  await expect(host.page.getByText("Most likely", { exact: true })).toBeVisible({ timeout: 8000 });

  await host.page.getByRole("button", { name: "Skip" }).click();
  await expect(host.page.getByText("THE ROOM RANKED YOU #1 FOR")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByText("Your orders matched the room for 35 points.")).toBeVisible();
  await expect(g2.page.getByText("THE ROOM RANKED YOU #3 FOR")).toBeVisible({ timeout: 15_000 });
  for (const p of [host, g1, g2]) await p.context.close();
});
