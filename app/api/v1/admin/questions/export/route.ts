import { route } from "@/lib/api/handler";
import { listQuestions, packNames } from "@/lib/admin/question-store";
import { questionsToCsv, Q_STATUSES, type QStatus } from "@/lib/admin/questions";
import { requireAdmin } from "@/lib/admin/server";

/** GET /admin/questions/export?pack=&status=&q=: questions as CSV (also a valid import file). */
export const GET = route(async (request) => {
  await requireAdmin(request, "questions.read");
  const params = new URL(request.url).searchParams;
  const packId = params.get("pack") || undefined;
  const rawStatus = params.get("status");
  const status = Q_STATUSES.includes(rawStatus as QStatus) ? (rawStatus as QStatus) : undefined;
  const search = params.get("q")?.trim().toLowerCase();
  const [questions, packs] = await Promise.all([listQuestions({ packId, status }), packNames()]);
  const byId = new Map(packs.map((p) => [p.id, p]));
  const list = questions
    .filter((q) => !search || q.text.toLowerCase().includes(search))
    .map((q) => {
      const p = byId.get(q.packId);
      return {
        ...q,
        packName: p?.name ?? q.packId,
        minAge: p?.min_age ?? 13,
        section: p?.section ?? "everyday",
        spice: p?.spice ?? 2,
      };
    });
  return new Response(questionsToCsv(list), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="spil-questions.csv"',
      "cache-control": "no-store",
    },
  });
});
