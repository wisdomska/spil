import { expect, test } from "@playwright/test";
import { adminLogin, createRoom, phone, startGame } from "./harness";
import { apiPlayer } from "./helpers";

// SPIL-01 admin cascade: Force advance moves a live room on, and the audit log records it.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
  info.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs the local or preview service key");
});

test("admin force advance moves a room on (SPIL-01)", async ({ browser, baseURL }) => {
  const host = await phone(browser, "host");
  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Senya" });
  await (await apiPlayer(baseURL!, "Kwame")).join(code);
  await startGame(host.page);

  const admin = await adminLogin(browser, baseURL!);
  try {
    await admin.page.goto("/admin/rooms");
    await admin.page.getByRole("searchbox").fill(code);
    const row = admin.page.getByRole("row").filter({ hasText: code });
    await row.getByRole("button", { name: "Force advance" }).click();
    await admin.page.getByRole("dialog").getByRole("button", { name: "Force advance" }).click();
    await expect(admin.page.getByText(`Room ${code} moved on.`)).toBeVisible();

    // Nobody answered, so the host sat out answering too: the host now guesses or waits.
    await expect(host.page.getByRole("progressbar", { name: "Questions answered" })).toBeHidden({
      timeout: 15_000,
    });

    await admin.page.goto("/admin/audit");
    await expect(admin.page.getByText("Forced a room on").first()).toBeVisible();
  } finally {
    await admin.cleanup();
    await host.context.close();
  }
});
