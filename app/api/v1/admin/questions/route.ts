import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import {
  existingKeys,
  insertQuestions,
  listQuestions,
  packNames,
} from "@/lib/admin/question-store";
import { checkQuestion, dedupeKey, normalizeQuestion } from "@/lib/admin/questions";
import { addQuestions } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";

/** GET /admin/questions: every question with yes and answered counts. */
export const GET = route(async (request) => {
  await requireAdmin(request, "questions.read");
  return listQuestions();
});

/**
 * POST /admin/questions: add one question, or several (one per line in the console). Text is
 * stored without "Have you ever"; duplicates already in the pack are skipped.
 */
export const POST = route(async (request) => {
  const me = await requireAdmin(request, "questions.write");
  const body = await readBody(request, addQuestions);
  const pack = (await packNames()).find((p) => p.id === body.packId);
  if (!pack) throw new ApiError("NOT_FOUND", "No pack with that id.");
  const texts = body.texts.map(normalizeQuestion).filter(Boolean);
  if (!texts.length) throw new ApiError("QUESTION_INVALID", "too_short");
  for (const t of texts) {
    const problem = checkQuestion(t);
    if (problem) throw new ApiError("QUESTION_INVALID", problem);
  }
  const seen = new Set((await existingKeys([pack.id])).map((q) => dedupeKey(q.packId, q.text)));
  const fresh: string[] = [];
  for (const t of texts) {
    const key = dedupeKey(pack.id, t);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(t);
  }
  if (!fresh.length) throw new ApiError("DUPLICATE");
  await insertQuestions(fresh.map((text) => ({ packId: pack.id, text, status: body.status })));
  if (fresh.length === 1)
    await audit(me, "question_added", fresh[0]!, null, {
      pack: pack.id,
      text: fresh[0],
      status: body.status,
    });
  else
    await audit(me, "questions_added", `${fresh.length} to ${pack.name}`, null, {
      pack: pack.id,
      count: fresh.length,
      status: body.status,
    });
  return { added: fresh.length, duplicates: texts.length - fresh.length };
});
