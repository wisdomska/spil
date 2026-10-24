import { route } from "@/lib/api/handler";
import { livePacks } from "@/lib/api/packs";
import { bandFloor, isAgeBand } from "@/lib/game";

/**
 * GET /packs?band=13_15|16_17|18_plus: the live packs that band may see (SPIL-02). A missing or
 * unknown band gets the safest list (13+). The lobby uses GET /rooms/:code/packs instead.
 */
export const GET = route(async (request) => {
  const band = new URL(request.url).searchParams.get("band");
  return livePacks(isAgeBand(band) ? bandFloor(band) : 13);
});
