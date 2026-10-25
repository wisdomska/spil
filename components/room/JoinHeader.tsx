import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/brand/Avatar";
import type { PublicRoom } from "@/lib/api/types";

/**
 * SPIL-19: whose room and which pack, above the age gate and the nickname form. Server-rendered,
 * so the first paint of an invite link already says where it leads. Not shown to the host.
 */
export async function JoinHeader({ room }: { room: PublicRoom }) {
  if (!room.hostNickname || room.playerCount === 0) return null;
  const t = await getTranslations("profile");
  return (
    <div className="mx-auto box-border w-full max-w-[480px] px-5 pt-4">
      <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <Avatar n={room.hostAvatar ?? 0} size={40} decorative />
        <div className="grid min-w-0 gap-1">
          <span className="truncate text-[16px] leading-[1.2] font-semibold">
            {t("joining", { host: room.hostNickname })}
          </span>
          <span className="truncate text-[14px] leading-[1.2] text-text-muted">
            {t("joiningMeta", { pack: room.pack.name, n: room.playerCount })}
          </span>
        </div>
      </div>
    </div>
  );
}
