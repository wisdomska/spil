import { getTranslations } from "next-intl/server";
import { roomsThisWeek } from "@/lib/api/stats";
import { showRoomCount } from "@/lib/game";

/** SPIL-22: "{n} rooms spilled this week" under the hero buttons, hidden in a quiet week. */
export async function RoomsCounter() {
  const n = await roomsThisWeek();
  if (!showRoomCount(n)) return null;
  const t = await getTranslations("landing");
  return (
    <span className="flex items-center gap-2 text-[14px] leading-[1.4] font-semibold">
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
      {t("roomsThisWeek", { n })}
    </span>
  );
}
