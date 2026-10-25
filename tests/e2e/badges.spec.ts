import { expect, test } from "@playwright/test";
import { answerAll, createRoom, phone, revealAndSkip } from "./harness";

// Badges: a first round earns First Spill, which unlocks the Ring frame.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("a first round earns a badge and a frame", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await createRoom(page, { pack: "classic", count: 5, nickname: "Senya" });
  await page.getByRole("button", { name: "Play solo" }).click();
  await answerAll(page, "YYNNY");
  await revealAndSkip(page);

  await page.goto("/badges");
  await expect(page.getByRole("heading", { name: "Your badges" })).toBeVisible();
  await expect(page.getByText("1 of 13 earned")).toBeVisible();
  const ring = page.getByRole("radio", { name: /Ring/ });
  await ring.click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(ring).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /Double/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await context.close();
});
