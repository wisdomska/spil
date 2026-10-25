import { requireUser } from "@/lib/api/auth";
import { myBadges } from "@/lib/api/achievements";
import { route } from "@/lib/api/handler";

/** GET /me/badges: my stats, badges with progress, and the frames and looks they unlock. */
export const GET = route(async (request) => myBadges(await requireUser(request)));
