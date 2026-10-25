import { expect, test } from "@playwright/test";
import { createRoom, phone } from "./harness";

// SPIL-21: a full code looks ready at once and joins without pressing the button.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("typing a valid code joins by itself", async ({ browser }) => {
  const host = await phone(browser, "host");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });

  const guest = await phone(browser, "guest");
  await guest.page.goto("/join");
  const join = guest.page.getByRole("button", { name: "Join with code" });
  const field = guest.page.getByLabel("Room code");
  await field.pressSequentially(code.slice(0, 3));
  await expect(join).toHaveAttribute("aria-disabled", "true");
  // Letters a code never has (I, O, 0, 1) do not count as ready.
  await field.press("I");
  await expect(join).toHaveAttribute("aria-disabled", "true");
  await field.press("Backspace");
  await field.press(code[3]!);
  await guest.page.waitForURL(new RegExp(`/r/${code}/me$`));

  // A code with no room keeps the error copy.
  await guest.page.goto("/join");
  await guest.page.getByLabel("Room code").fill("ZZZZ");
  await expect(guest.page.getByText("No room with that code.", { exact: false })).toBeVisible();
  await expect(guest.page).toHaveURL(/\/join$/);
  for (const p of [host, guest]) await p.context.close();
});
