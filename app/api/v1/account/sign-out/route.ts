import { signOut } from "@/lib/api/account";
import { route } from "@/lib/api/handler";

/** POST /account/sign-out: ends this phone's session; the next room starts a fresh guest. */
export const POST = route(async () => {
  await signOut();
  return { ok: true };
});
