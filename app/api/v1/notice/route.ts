import { NextResponse } from "next/server";
import { getSettings } from "@/lib/flags";

/**
 * GET /notice: the notice admins show to every player (maintenance, events), or an empty text
 * when it is off. Cached 30 seconds at the edge so a busy night stays cheap.
 */
export async function GET() {
  const s = await getSettings();
  return NextResponse.json(
    { text: s.noticeOn ? s.notice.trim() : "" },
    { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
