import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/admin/server";
import { pushConfigured, sendTest } from "@/lib/push/server";

/**
 * GET /admin/push-test: whether push is set up (VAPID keys) for the Settings card.
 * POST /admin/push-test: sends a test notification to the calling admin's own devices.
 */
export const GET = route(async (request) => {
  await requireAdmin(request, "account.self");
  return { configured: pushConfigured() };
});

export const POST = route(async (request) => {
  const me = await requireAdmin(request, "account.self");
  if (!pushConfigured()) return { configured: false, sent: 0, devices: 0 };
  return { configured: true, ...(await sendTest(me.userId)) };
});
