import type { RoomState } from "@/lib/api/types";

/**
 * The per-mode data the reveal needs, picked from a room's results. Shared by the phone (RoomApp)
 * and the Party Mode screen, so both reveal exactly the same slides.
 */
export function revealProps(
  mode: RoomState["room"]["mode"],
  results: NonNullable<RoomState["results"]>,
) {
  return {
    rows: results.rows,
    awards: results.awards,
    exact: results.exact,
    percent: mode === "room_percentage" || mode === "hot_takes" ? results.percent : undefined,
    likely: mode === "most_likely" ? results.likely : undefined,
    flags: mode === "red_green" ? results.flags : undefined,
    ranked: mode === "rank_room" ? results.ranked : undefined,
    imposter: mode === "imposter" ? results.imposter : undefined,
    cards: mode === "two_truths" ? results.cards : undefined,
    said: mode === "who_said" ? results.said : undefined,
    average: mode === "hot_takes",
  };
}
