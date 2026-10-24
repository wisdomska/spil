import { expect, test } from "@playwright/test";
import { answerAll, createRoom, phone, startGame } from "./harness";
import { apiPlayer } from "./helpers";

// SPIL-10: the vessel is the guess input. Phone host, API guest. Runs once.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("guess with the vessel: no value until touched, keyboard and drag (SPIL-10)", async ({
  browser,
  baseURL,
}) => {
  const host = await phone(browser, "guest");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Senya" });
  const guest = await apiPlayer(baseURL!, "Kwame");
  await guest.join(code);
  await startGame(host.page);
  await guest.answerAll(code);
  await answerAll(host.page, "YNYNY");

  const vessel = host.page.getByRole("slider", { name: "Your guess for Kwame" });
  const lock = host.page.getByRole("button", { name: "Lock it in" });
  await expect(vessel).toBeVisible();
  await expect(vessel).not.toHaveAttribute("aria-valuenow");
  await expect(vessel).toHaveAttribute("aria-valuetext", "No guess yet");
  await expect(host.page.getByText("Drag the liquid")).toBeVisible();
  await expect(lock).toHaveAttribute("aria-disabled", "true");

  // Drag: the middle of the vessel is about 50, and the page does not scroll while dragging.
  const box = (await vessel.boundingBox())!;
  const scrollBefore = await host.page.evaluate(() => window.scrollY);
  await host.page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9);
  await host.page.mouse.down();
  await host.page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5, { steps: 8 });
  await host.page.mouse.up();
  const dragged = Number(await vessel.getAttribute("aria-valuenow"));
  expect(dragged).toBeGreaterThanOrEqual(48);
  expect(dragged).toBeLessThanOrEqual(52);
  expect(await host.page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  // Keyboard: Home, PageUp, arrows; the value text carries the label.
  await vessel.focus();
  await host.page.keyboard.press("Home");
  await host.page.keyboard.press("PageUp");
  await host.page.keyboard.press("ArrowUp");
  await expect(vessel).toHaveAttribute("aria-valuenow", "11");
  await expect(vessel).toHaveAttribute("aria-valuetext", /^11, /);
  await host.page.keyboard.press("End");
  await expect(vessel).toHaveAttribute("aria-valuenow", "100");
  await expect(lock).not.toHaveAttribute("aria-disabled");
  await lock.click();
  await expect(host.page.getByText(/Lights down|Waiting on/).first()).toBeVisible({
    timeout: 15_000,
  });
  await host.context.close();
});
