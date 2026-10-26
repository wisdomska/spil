import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { passAgeGate } from "./harness";

export type Player = { page: Page; context: BrowserContext; name: string };

/** Fresh browser context (a different phone). */
export async function newPlayer(browser: Browser, name: string) {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  return { page, context, name } satisfies Player;
}

/** Host: Start a game, pick a pack and length, set a profile, land in the lobby. Returns the code. */
export async function hostRoom(
  host: Player,
  opts: { pack?: string; count?: number; age?: number } = {},
) {
  const { page } = host;
  await page.goto("/");
  await page.getByRole("link", { name: "Start a game" }).first().click();
  await passAgeGate(page, opts.age ?? 25);
  await expect(page.getByRole("heading", { name: "What are we playing?" })).toBeVisible();
  await page.getByRole("button", { name: /^Spill Score/ }).click();
  await expect(page.getByRole("heading", { name: "Pick your poison." })).toBeVisible();
  if (opts.pack)
    await page
      .getByRole("radio", { name: new RegExp(opts.pack, "i") })
      .first()
      .click();
  if (opts.count)
    await page.getByRole("radio", { name: new RegExp(`^(All )?${opts.count}$`) }).click();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/);
  const code = page.url().match(/\/r\/([A-Z0-9]{4})\/me/)![1]!;
  await fillProfile(page, host.name);
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await page.waitForURL(new RegExp(`/r/${code}$`));
  await expect(page.getByRole("heading", { name: "In the room" })).toBeVisible();
  return code;
}

export async function fillProfile(page: Page, name: string) {
  await page.getByLabel("Nickname").fill(name);
  await page.getByRole("radio", { name: "Avatar: Cowboy" }).click();
}

/** Guest: Join with code, set a profile, land in the lobby. */
export async function joinRoom(guest: Player, code: string, age = 25) {
  const { page } = guest;
  await page.goto("/join");
  // SPIL-21: a full code joins by itself, no button press.
  await page.getByLabel("Room code").fill(code);
  await page.waitForURL(new RegExp(`/r/${code}/me$`));
  await passAgeGate(page, age);
  await fillProfile(page, guest.name);
  await page.getByRole("button", { name: "Join the room" }).click();
  await page.waitForURL(new RegExp(`/r/${code}$`));
  await expect(page.getByText(/Waiting for .* to start/)).toBeVisible();
}

/** Answers every question with the keyboard (Y/N), the fastest path a real player has. */
export async function answerAll(page: Page, pattern: (i: number) => "y" | "n") {
  const progress = page.getByRole("progressbar", { name: "Questions answered" });
  await expect(progress).toBeVisible();
  const total = Number(await progress.getAttribute("aria-valuemax"));
  for (let i = 0; i < total; i++) {
    await expect(
      page.getByRole("group", { name: new RegExp(`^Question ${i + 1} of ${total}`) }),
    ).toBeVisible();
    await page.keyboard.press(pattern(i));
  }
}

/** Locks a guess for everyone, moving the slider with the keyboard. */
export async function guessAll(page: Page, value: (i: number) => number) {
  await expect(page.getByText(/^Guess 1 of \d+$/)).toBeVisible();
  const total = Number(
    (await page.getByText(/^Guess 1 of \d+$/).textContent())!.match(/of (\d+)/)![1],
  );
  for (let i = 0; i < total; i++) {
    await expect(page.getByText(`Guess ${i + 1} of ${total}`)).toBeVisible();
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("Home");
    for (let k = 0; k < Math.round(value(i) / 10); k++) await page.keyboard.press("PageUp");
    await page.getByRole("button", { name: "Lock it in" }).click();
  }
}

/**
 * Extra players driven straight through the API with their own anonymous sessions, for large
 * rooms (7, 12) where opening a browser per player would only slow the suite down.
 */
export async function apiPlayer(baseURL: string, name: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
    },
  );
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  const token = data.session.access_token;
  const call = async <T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    const res = await fetch(`${baseURL}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text}`);
    return (text ? JSON.parse(text) : {}) as T;
  };
  return {
    name,
    join: (code: string, ageBand: "13_15" | "16_17" | "18_plus" = "18_plus") =>
      call("POST", `/rooms/${code}/join`, {
        nickname: name,
        avatar: name.length % 24,
        ageBand,
      }),
    answerAll: async (code: string, yesEvery = 2) => {
      // The host's Start may still be in flight; questions appear once the round has begun.
      let questions: Array<{ id: string }> | undefined;
      for (let i = 0; i < 40 && !questions?.length; i++) {
        if (i) await new Promise((r) => setTimeout(r, 500));
        ({ questions } = await call<{ questions?: Array<{ id: string }> }>(
          "GET",
          `/rooms/${code}/state`,
        ));
      }
      if (!questions?.length) throw new Error(`no questions in room ${code}`);
      await call("PUT", `/rooms/${code}/answers`, {
        answers: questions.map((q, i) => ({
          questionId: q.id,
          value: i % yesEvery === 0 ? "yes" : "no",
        })),
      });
      await call("POST", `/rooms/${code}/answers/submit`);
    },
    guessAll: async (code: string, value = 50) => {
      type S = {
        room: { status: string };
        me: { id: string };
        players: Array<{ id: string; status: string }>;
      };
      // The last answer may still be in flight; wait until the room has moved to guessing.
      let state = await call<S>("GET", `/rooms/${code}/state`);
      for (let i = 0; i < 40 && state.room.status !== "guessing"; i++) {
        await new Promise((r) => setTimeout(r, 500));
        state = await call<S>("GET", `/rooms/${code}/state`);
      }
      const others = state.players.filter((p) => p.id !== state.me.id && p.status === "active");
      await call("PUT", `/rooms/${code}/guesses`, {
        guesses: others.map((o) => ({ targetId: o.id, value })),
      });
      await call("POST", `/rooms/${code}/guesses/submit`);
    },
    call,
  };
}
