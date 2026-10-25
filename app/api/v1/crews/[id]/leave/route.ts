import { requireUser } from "@/lib/api/auth";
import { leaveCrew } from "@/lib/api/crews";
import { route } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

/** POST /crews/:id/leave: leave a crew; your past rounds stop counting in its table. */
export const POST = route<Ctx>(async (request, { params }) => {
  const userId = await requireUser(request);
  const { id } = await params;
  await leaveCrew(id, userId);
  return {};
});
