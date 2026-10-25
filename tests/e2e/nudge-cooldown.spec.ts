import { expect, test } from "@playwright/test";
import { answerAll, createRoom, joinRoom, phone } from "./harness";

// SPIL-29: after a nudge the button counts down 20 seconds and sends nothing meanwhile.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("nudge has a visible cooldown", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await host.page.getByRole("button", { name: "Start the game" }).click();
  await answerAll(host.page, "YN");

  const nudges: string[] = [];
  host.page.on("request", (r) => r.url().endsWith("/nudge") && nudges.push(r.url()));
  await host.page.getByRole("button", { name: "Nudge Esi" }).click();
  const again = host.page.getByRole("button", { name: /^Nudge again in \d+s$/ });
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await again.click({ force: true });
  await again.click({ force: true });
  await expect(host.page.getByRole("button", { name: /Nudge again in 1[0-8]s/ })).toBeVisible({
    timeout: 5000,
  });
  expect(nudges).toHaveLength(1);
  for (const p of [host, guest]) await p.context.close();
});
