import { accountsReady } from "@/lib/api/account";
import { route } from "@/lib/api/handler";

/** GET /account/ready: whether accounts are switched on (their migration is applied). Public. */
export const GET = route(async () => {
  const ready = await accountsReady();
  return Response.json(
    { ready },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
});
