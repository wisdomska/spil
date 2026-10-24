import { route } from "@/lib/api/handler";
import { previewQuestions, requireLivePack } from "@/lib/api/packs";
import { bandFloor, isAgeBand } from "@/lib/game";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /packs/:id/preview?band=: three sample questions for the pack picker (SPIL-08). The band
 * must reach the pack's minimum age, so an adult pack's questions never reach a minor.
 */
export const GET = route<Ctx>(async (request, { params }) => {
  const { id } = await params;
  const band = new URL(request.url).searchParams.get("band");
  const pack = await requireLivePack(id, isAgeBand(band) ? bandFloor(band) : 13);
  return { questions: await previewQuestions(pack.id) };
});
