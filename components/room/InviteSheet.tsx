"use client";

import {
  ChatTextIcon,
  CheckIcon,
  CopyIcon,
  DiscordLogoIcon,
  EnvelopeSimpleIcon,
  FacebookLogoIcon,
  InstagramLogoIcon,
  MessengerLogoIcon,
  ShareNetworkIcon,
  SnapchatLogoIcon,
  TelegramLogoIcon,
  ThreadsLogoIcon,
  WhatsappLogoIcon,
  XLogoIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics/posthog";
import { useCopyLink } from "./RoomShell";

type Target = {
  id: string;
  label: string;
  Icon: Icon;
  /** A URL that opens the platform with the invite filled in. */
  href?: (link: string, text: string) => string;
  /** Platforms without a web share link: copy the invite, then open the app to paste it. */
  paste?: string;
};

const enc = encodeURIComponent;
const TARGETS: Target[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    Icon: WhatsappLogoIcon,
    href: (l, t) => `https://wa.me/?text=${enc(`${t} ${l}`)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    Icon: InstagramLogoIcon,
    paste: "https://www.instagram.com/direct/inbox/",
  },
  {
    id: "snapchat",
    label: "Snapchat",
    Icon: SnapchatLogoIcon,
    href: (l) => `https://www.snapchat.com/scan?attachmentUrl=${enc(l)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    Icon: TelegramLogoIcon,
    href: (l, t) => `https://t.me/share/url?url=${enc(l)}&text=${enc(t)}`,
  },
  {
    id: "x",
    label: "X",
    Icon: XLogoIcon,
    href: (l, t) => `https://x.com/intent/post?text=${enc(t)}&url=${enc(l)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    Icon: FacebookLogoIcon,
    href: (l) => `https://www.facebook.com/sharer/sharer.php?u=${enc(l)}`,
  },
  {
    id: "messenger",
    label: "Messenger",
    Icon: MessengerLogoIcon,
    paste: "https://www.messenger.com/",
  },
  {
    id: "threads",
    label: "Threads",
    Icon: ThreadsLogoIcon,
    href: (l, t) => `https://www.threads.net/intent/post?text=${enc(`${t} ${l}`)}`,
  },
  {
    id: "discord",
    label: "Discord",
    Icon: DiscordLogoIcon,
    paste: "https://discord.com/channels/@me",
  },
  {
    id: "sms",
    label: "Messages",
    Icon: ChatTextIcon,
    href: (l, t) => `sms:?&body=${enc(`${t} ${l}`)}`,
  },
  {
    id: "email",
    label: "Email",
    Icon: EnvelopeSimpleIcon,
    href: (l, t) => `mailto:?subject=${enc("Join my SPIL room")}&body=${enc(`${t} ${l}`)}`,
  },
];

const noop = () => () => {};
/** The system share menu exists on phones and some desktops; checked after mount. */
function useCanShare() {
  return useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
}

const TILE =
  "group grid justify-items-center gap-2 rounded-card border-0 bg-transparent px-1 py-2 text-[13px] leading-tight font-semibold text-text no-underline hover:text-text";
const DISC =
  "grid size-14 place-items-center rounded-full border border-line bg-surface text-[26px] text-text transition-colors group-hover:bg-surface-raised group-focus-visible:bg-surface-raised";

/** Invite sheet: share the room link to any app, or copy it. */
export function InviteSheet({
  open,
  onOpenChange,
  code,
  link,
  text,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  link: string;
  text: string;
}) {
  const t = useTranslations("room");
  const tt = useTranslations("toast");
  const toast = useToast();
  const { copied, copy } = useCopyLink(code);
  const canShare = useCanShare();

  const sent = (via: string) => {
    track("invite_shared", { via });
    onOpenChange(false);
  };

  const pasteInto = async (target: Target) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard blocked: the link is still shown in the sheet
    }
    toast(tt("pasteInApp", { app: target.label }));
    window.open(target.paste, "_blank", "noopener");
    sent(target.id);
  };

  const more = async () => {
    try {
      await navigator.share({ title: "SPIL", text, url: link });
      sent("system");
    } catch {
      // dismissed
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("inviteTitle")}
      description={t("inviteBody")}
    >
      <ul className="m-0 grid min-w-0 list-none grid-cols-4 gap-x-1 gap-y-3 p-0 sm:grid-cols-6 lg:grid-cols-4">
        {TARGETS.map((target) => (
          <li key={target.id}>
            {target.href ? (
              <a
                href={target.href(link, text)}
                target="_blank"
                rel="noopener"
                onClick={() => sent(target.id)}
                className={TILE}
              >
                <span className={DISC}>
                  <target.Icon aria-hidden />
                </span>
                {target.label}
              </a>
            ) : (
              <button type="button" onClick={() => pasteInto(target)} className={`${TILE} w-full`}>
                <span className={DISC}>
                  <target.Icon aria-hidden />
                </span>
                {target.label}
              </button>
            )}
          </li>
        ))}
        {canShare && (
          <li>
            <button type="button" onClick={more} className={`${TILE} w-full`}>
              <span className={DISC}>
                <ShareNetworkIcon aria-hidden />
              </span>
              {t("moreApps")}
            </button>
          </li>
        )}
      </ul>

      <div className="mt-2 flex min-w-0 items-center gap-2 rounded-pill border border-line bg-surface p-1.5 pl-4">
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-text-muted">
          {link.replace(/^https?:\/\//, "")}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex h-11 shrink-0 items-center gap-2 rounded-pill border-0 bg-text px-4 text-[15px] leading-none font-semibold text-bg hover:brightness-[1.08]"
        >
          {copied ? (
            <CheckIcon size={18} aria-hidden className="animate-icon-in" />
          ) : (
            <CopyIcon size={18} aria-hidden />
          )}
          {copied ? t("copied") : t("copyLink")}
        </button>
      </div>
    </Sheet>
  );
}
