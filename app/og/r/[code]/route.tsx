import { getTranslations } from "next-intl/server";
import { findRoom, loadPack, loadPlayers } from "@/lib/api/rooms";
import { ogCard } from "@/lib/og";

/** Invite link preview: who is hosting and which pack, so the group chat knows what it is. */
export async function GET(_request: Request, ctx: RouteContext<"/og/r/[code]">) {
  const { code } = await ctx.params;
  const t = await getTranslations();
  const room = await findRoom(code.toUpperCase()).catch(() => null);
  if (!room) {
    return ogCard({
      headline: t("landing.headline"),
      emphasis: t("landing.headlineEmphasis"),
      footer: t("card.domain"),
    });
  }
  const [players, pack] = await Promise.all([loadPlayers(room.id), loadPack(room.pack_id)]);
  const host = players.find((p) => p.id === room.host_player_id)?.nickname;
  return ogCard({
    headline: t("meta.roomTitle", { code: room.code }),
    footer: `${pack.name} · ${host ?? "SPIL"} · ${t("card.domain")}`,
  });
}
