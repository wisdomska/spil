import { NextResponse } from "next/server";
import { roomsThisWeek } from "@/lib/api/stats";

/** GET /stats/public: rooms spilled in the last 7 days, cached 10 minutes at the edge (SPIL-22). */
export async function GET() {
  return NextResponse.json(
    { roomsThisWeek: await roomsThisWeek() },
    { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=600" } },
  );
}
