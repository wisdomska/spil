import { requireUser } from "@/lib/api/auth";
import { accountOf, guestHasProgress } from "@/lib/api/account";
import { route } from "@/lib/api/handler";

/** GET /account/guest: whether this phone's guest has progress worth adding when signing in. */
export const GET = route(async (request) => {
  const userId = await requireUser(request);
  if (await accountOf(userId)) return { progress: false };
  return { progress: await guestHasProgress(userId) };
});
