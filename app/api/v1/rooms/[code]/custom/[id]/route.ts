import { requireUser } from "@/lib/api/auth";
import { removeCustom } from "@/lib/api/customPacks";
import { route } from "@/lib/api/handler";
import { requireMember } from "@/lib/api/rooms";

type Ctx = { params: Promise<{ code: string; id: string }> };

/** DELETE /rooms/:code/custom/:id: the host removes one of their questions. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  const userId = await requireUser(request);
  const { code, id } = await params;
  const room = await requireMember(code.toUpperCase(), userId);
  return removeCustom(room, id);
});
