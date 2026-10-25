import { crewByToken } from "@/lib/api/crews";
import { route } from "@/lib/api/handler";

type Ctx = { params: Promise<{ token: string }> };

/** GET /crews/invite/:token: the crew an invite link is for (name and size only). */
export const GET = route<Ctx>(async (_request, { params }) => {
  const { token } = await params;
  const crew = await crewByToken(token);
  return { name: crew.name, members: crew.members };
});
