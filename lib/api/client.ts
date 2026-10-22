"use client";

import { getBrowserClient } from "@/lib/supabase/client";
import type { ApiErrorBody } from "./types";

export class ClientApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let signingIn: Promise<void> | null = null;

/**
 * Makes sure this browser has a Supabase session, signing in anonymously the first time.
 * The session lives in cookies, so refresh and reopen keep the player in their room.
 */
export async function ensureSession(getCaptchaToken?: () => Promise<string | undefined>) {
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  signingIn ??= (async () => {
    const captchaToken = await getCaptchaToken?.();
    return supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined,
    );
  })()
    .then(({ error }) => {
      if (error) throw new ClientApiError("UNAUTHENTICATED", error.message, 401);
    })
    .finally(() => {
      signingIn = null;
    });
  await signingIn;
}

/** Calls /api/v1 with the session cookie. Throws ClientApiError with the API's error code. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ClientApiError("OFFLINE", "You're offline.", 0);
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T | ApiErrorBody) : ({} as T);
  if (!res.ok) {
    const error = (data as ApiErrorBody).error;
    throw new ClientApiError(error?.code ?? "INTERNAL", error?.message ?? "", res.status);
  }
  return data as T;
}
