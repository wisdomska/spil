import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Multiplayer QA harness (fix handoff, section 5.1). Every helper drives one browser context,
 * which is one phone with its own anonymous Supabase session. Helpers tolerate screens that
 * later tickets add (the SPIL-02 age gate, SPIL-26 avatar names, SPIL-11 host-paced reveal), so
 * tests written now keep working as those land.
 */

export const VIEWPORT = {
  guest: { width: 375, height: 812 },
  host: { width: 1280, height: 800 },
} as const;

export type Opts = { age?: number; nickname?: string };

/** A new phone: its own context, so its own cookies and anonymous session. */
export async function phone(browser: Browser, size: keyof typeof VIEWPORT = "guest") {
  const context = await browser.newContext({ viewport: VIEWPORT[size] });
  const page = await context.newPage();
  return { context, page };
}

/**
 * SPIL-02 age gate: answers it when it is shown, does nothing when the device already gave an
 * age. Waits for the page to show either the age screen or what comes after it.
 */
export async function passAgeGate(page: Page, age = 25) {
  const heading = page.getByRole("heading", { name: "How old are you?" });
  const after = page.getByRole("heading", {
    name: /What should we call you\?|Pick your poison\.|SPIL is for ages 13|18\+ pack/,
  });
  await heading.or(after).first().waitFor({ timeout: 30_000 });
  if (!(await heading.isVisible())) return;
  await page.getByLabel("Your age").fill(String(age));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

/** Nickname and face on /r/[code]/me. Picks the fifth face by position, not by name. */
export async function fillProfile(page: Page, nickname: string) {
  await page.getByLabel("Nickname").fill(nickname);
  const faces = page.getByRole("radiogroup").first().getByRole("radio");
  await faces.nth(4).click();
}

/** Host: age gate, pack and length, nickname, lobby. Returns the room code. */
export async function createRoom(
  page: Page,
  { age = 25, pack, count, nickname = "Host" }: Opts & { pack?: string; count?: number } = {},
) {
  await page.goto("/create");
  await passAgeGate(page, age);
  await expect(page.getByRole("heading", { name: "Pick your poison." })).toBeVisible();
  if (pack)
    await page
      .getByRole("radio", { name: new RegExp(pack, "i") })
      .first()
      .click();
  if (count) await page.getByRole("radio", { name: new RegExp(`^(All )?${count}$`) }).click();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/, { timeout: 30_000 });
  const code = page.url().match(/\/r\/([A-Z0-9]{4})\/me/)![1]!;
  await passAgeGate(page, age);
  await fillProfile(page, nickname);
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await page.waitForURL(new RegExp(`/r/${code}$`));
  await expect(page.getByRole("heading", { name: "In the room" })).toBeVisible();
  return code;
}

/** Guest: opens the invite link, age gate, nickname, lobby. */
export async function joinRoom(
  page: Page,
  code: string,
  { age = 25, nickname = "Guest" }: Opts = {},
) {
  await page.goto(`/r/${code}/me`);
  await passAgeGate(page, age);
  await fillProfile(page, nickname);
  await page.getByRole("button", { name: "Join the room" }).click();
  await page.waitForURL(new RegExp(`/r/${code}$`));
  await expect(page.getByText(/Waiting for .* to start/)).toBeVisible();
}

export async function startGame(host: Page) {
  await host.getByRole("button", { name: "Start the game" }).click();
  await expect(host.getByRole("progressbar", { name: "Questions answered" })).toBeVisible();
}

type Pattern = string | ((i: number) => "y" | "n");
const keyFor = (pattern: Pattern, i: number) =>
  typeof pattern === "string" ? (pattern[i % pattern.length] === "Y" ? "y" : "n") : pattern(i);

/** Answers questions with the keyboard; pattern "YNYNY" or a function per index. */
export async function answerSome(page: Page, count: number, pattern: Pattern = "Y") {
  const progress = page.getByRole("progressbar", { name: "Questions answered" });
  await expect(progress).toBeVisible();
  const total = Number(await progress.getAttribute("aria-valuemax"));
  for (let i = 0; i < Math.min(count, total); i++) {
    await expect(
      page.getByRole("group", { name: new RegExp(`^Question ${i + 1} of ${total}`) }),
    ).toBeVisible();
    await page.keyboard.press(keyFor(pattern, i));
  }
  return total;
}

export async function answerAll(page: Page, pattern: Pattern = "YN") {
  const progress = page.getByRole("progressbar", { name: "Questions answered" });
  await expect(progress).toBeVisible();
  const total = Number(await progress.getAttribute("aria-valuemax"));
  await answerSome(page, total, pattern);
}

/** Sets the current guess with the keyboard; works for the slider and the SPIL-10 vessel. */
export async function guess(page: Page, value: number) {
  const input = page.getByRole("slider").first();
  await input.focus();
  await page.keyboard.press("Home");
  for (let k = 0; k < Math.floor(value / 10); k++) await page.keyboard.press("PageUp");
  for (let k = 0; k < value % 10; k++) await page.keyboard.press("ArrowRight");
}

export async function lockIn(page: Page) {
  await page.getByRole("button", { name: "Lock it in" }).click();
}

/** Guesses the same value for every target, locking each one. */
export async function guessAll(page: Page, value = 50) {
  const first = page.getByText(/^Guess 1 of \d+$/);
  await expect(first).toBeVisible();
  const total = Number((await first.textContent())!.match(/of (\d+)/)![1]);
  for (let i = 0; i < total; i++) {
    await expect(page.getByText(`Guess ${i + 1} of ${total}`)).toBeVisible();
    await guess(page, value);
    await lockIn(page);
  }
}

/**
 * Host moves every phone to the next reveal slide (SPIL-11): waits for Next to unlock, then taps
 * it. Returns false when there is no Next (the reveal is over).
 */
export async function nextReveal(host: Page) {
  const next = host.getByRole("button", { name: "Next", exact: true });
  if (!(await next.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  await expect(next).not.toHaveAttribute("aria-disabled", "true", { timeout: 15_000 });
  await next.click();
  return true;
}

/** Host starts the reveal from "Lights down" and skips it; every phone lands on the results. */
export async function revealAndSkip(host: Page, guests: Page[] = []) {
  await host.getByRole("button", { name: "Start the reveal" }).click();
  await host.getByRole("button", { name: "Skip" }).click();
  for (const p of [host, ...guests])
    await expect(p.getByRole("tab", { name: "Scores" })).toBeVisible({ timeout: 30_000 });
}

/**
 * Admin console session without a password, for local and preview only: signs in a fresh
 * anonymous user, lists it in `admins` with the given role, and puts its session cookie in a new
 * context. Call `cleanup()` to delete the user again. Refuses to run against production.
 */
export async function adminLogin(
  browser: Browser,
  baseURL: string,
  role: "owner" | "content_lead" | "moderator" = "owner",
): Promise<{ context: BrowserContext; page: Page; cleanup: () => Promise<void> }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("adminLogin needs SUPABASE_SERVICE_ROLE_KEY (local or preview)");
  if (url.includes("vhrtnirvvkiybxjufmsm"))
    throw new Error("adminLogin never runs against production");

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInAnonymously();
  if (error || !data.session) throw new Error(`admin sign-in failed: ${error?.message}`);
  const userId = data.user!.id;
  const { error: insertError } = await service.from("admins").insert({
    user_id: userId,
    email: `qa-${userId.slice(0, 8)}@spil.test`,
    name: `QA ${role}`,
    role,
  });
  if (insertError) throw new Error(`admins insert failed: ${insertError.message}`);

  // @supabase/ssr cookie: "base64-" + base64url(session JSON), in 3180-character chunks.
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const chunks = value.match(/.{1,3180}/g)!;
  const domain = new URL(baseURL).hostname;
  const context = await browser.newContext({ viewport: VIEWPORT.host });
  await context.addCookies(
    (chunks.length === 1 ? [[name, value]] : chunks.map((c, i) => [`${name}.${i}`, c])).map(
      ([n, v]) => ({ name: n!, value: v!, domain, path: "/", sameSite: "Lax" as const }),
    ),
  );
  const page = await context.newPage();
  return {
    context,
    page,
    cleanup: async () => {
      await context.close();
      await service.from("admins").delete().eq("user_id", userId);
      await service.auth.admin.deleteUser(userId);
    },
  };
}
