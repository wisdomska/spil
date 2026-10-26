import { requireUser } from "@/lib/api/auth";
import { accountOf, createAccount, deleteAccount } from "@/lib/api/account";
import { clientIp, readBody, route } from "@/lib/api/handler";
import { verifyTurnstile } from "@/lib/turnstile";
import { createAccount as createBody, deleteAccount as deleteBody } from "@/lib/validation/schemas";

/** GET /account: this phone's account, or null for a guest. */
export const GET = route(async (request) => ({
  account: await accountOf(await requireUser(request)),
}));

/**
 * POST /account: save your progress. The guest on this phone gets a username and password and
 * keeps its id; the one-time recovery code comes back once. Bot checked, 5 per hour per guest.
 */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, createBody);
  await verifyTurnstile(body.captchaToken, clientIp(request), "account", request);
  return createAccount(userId, body.username, body.password);
});

/** DELETE /account: removes the account and its data, after typing the username to confirm. */
export const DELETE = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, deleteBody);
  await deleteAccount(userId, body.username);
  return { ok: true };
});
