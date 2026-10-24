import { expect, test } from "@playwright/test";
import {
  adminLogin,
  answerAll,
  createRoom,
  guessAll,
  joinRoom,
  phone,
  revealAndSkip,
  startGame,
} from "./harness";

// Self-test for the QA harness: a 2-player game across a desktop host and a phone guest, and an
// admin session. Runs once (desktop project); the helpers set their own viewports.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("harness: 2-player game from create to results", async ({ browser }) => {
  const host = await phone(browser, "host");
  const guest = await phone(browser, "guest");
  const code = await createRoom(host.page, { age: 25, pack: "classic", count: 5, nickname: "Ama" });
  await joinRoom(guest.page, code, { age: 22, nickname: "Kwame" });
  await startGame(host.page);
  await answerAll(host.page, "YNYNY");
  await answerAll(guest.page, "NNYNN");
  await guessAll(host.page, 40);
  await guessAll(guest.page, 60);
  await expect(host.page.getByRole("button", { name: "Start the reveal" })).toBeVisible();
  await revealAndSkip(host.page, [guest.page]);
  await host.context.close();
  await guest.context.close();
});

test("harness: admin session opens the console", async ({ browser, baseURL }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs the local or preview service key");
  const admin = await adminLogin(browser, baseURL!);
  try {
    await admin.page.goto("/admin");
    await expect(admin.page.getByRole("heading", { name: "Overview" })).toBeVisible();
  } finally {
    await admin.cleanup();
  }
});
