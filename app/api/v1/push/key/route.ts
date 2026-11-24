import { connection, NextResponse } from "next/server";
import { vapidKeys } from "@/lib/push/keys";

/**
 * GET /push/key: the public half of the Web Push key pair, which a browser needs to subscribe
 * (owner request 2026-11-24). Public by design; 204 when push is unavailable.
 */
export async function GET() {
  await connection();
  const keys = await vapidKeys();
  if (!keys) return new NextResponse(null, { status: 204 });
  return NextResponse.json(
    { publicKey: keys.publicKey },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
