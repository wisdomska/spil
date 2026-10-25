import { requireUser } from "@/lib/api/auth";
import { crewDetail } from "@/lib/api/crews";
import { route } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

/** GET /crews/:id?season=YYYY-MM: members only. Season table, history, members, invite link. */
export const GET = route<Ctx>(async (request, { params }) => {
  const userId = await requireUser(request);
  const { id } = await params;
  const season = new URL(request.url).searchParams.get("season") ?? undefined;
  return crewDetail(id, userId, season);
});
