import { readBody, route } from "@/lib/api/handler";
import { existingKeys, insertQuestions, packNames } from "@/lib/admin/question-store";
import { parseQuestionImport } from "@/lib/admin/questions";
import { importQuestions } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import type { ImportSummary } from "@/lib/admin/types";

/**
 * POST /admin/questions/import: bulk CSV import. Columns: `question` plus `pack_id` or `pack`
 * (id or name), optional `status` and `is_sample` (true or false). Nothing is written when any row has an error, so a fixed
 * file can simply be imported again.
 */
export const POST = route(async (request): Promise<ImportSummary> => {
  const me = await requireAdmin(request, "questions.write");
  const body = await readBody(request, importQuestions);
  const packs = await packNames();
  const parsed = parseQuestionImport(body.csv, packs, await existingKeys(), body.defaultStatus);
  if (parsed.errors.length)
    return { added: 0, duplicates: parsed.duplicates, errors: parsed.errors };
  if (parsed.rows.length) {
    await insertQuestions(parsed.rows);
    const perPack = new Map<string, number>();
    for (const r of parsed.rows) perPack.set(r.packId, (perPack.get(r.packId) ?? 0) + 1);
    await audit(me, "questions_imported", `${parsed.rows.length} questions`, null, {
      packs: Object.fromEntries(perPack),
      duplicates: parsed.duplicates,
    });
  }
  return { added: parsed.rows.length, duplicates: parsed.duplicates, errors: [] };
});
