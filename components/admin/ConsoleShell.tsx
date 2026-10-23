"use client";

import {
  ArrowSquareOutIcon,
  CardsIcon,
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  DoorOpenIcon,
  EnvelopeSimpleIcon,
  FlagIcon,
  GearSixIcon,
  ListBulletsIcon,
  ListIcon,
  SignOutIcon,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { sectionsFor, type Section } from "@/lib/admin/roles";
import type { Counts, Me } from "@/lib/admin/types";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useAdminQuery } from "./ui";

const MeContext = createContext<Me | null>(null);

/** The signed-in admin. Only used inside the console layout. */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside the admin console");
  return me;
}

const NAV: Record<Section, { href: string; icon: Icon; badge?: keyof Counts; alert?: boolean }> = {
  overview: { href: "/admin", icon: ChartBarIcon },
  rooms: { href: "/admin/rooms", icon: DoorOpenIcon, badge: "liveRooms" },
  packs: { href: "/admin/packs", icon: CardsIcon, badge: "packs" },
  questions: { href: "/admin/questions", icon: ListBulletsIcon, badge: "questions" },
  reports: { href: "/admin/reports", icon: FlagIcon, badge: "openReports", alert: true },
  inbox: { href: "/admin/inbox", icon: EnvelopeSimpleIcon, badge: "newMessages", alert: true },
  audit: { href: "/admin/audit", icon: ClockCounterClockwiseIcon },
  settings: { href: "/admin/settings", icon: GearSixIcon },
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Nav({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const path = usePathname();
  const counts = useAdminQuery<Counts>("/counts");
  return (
    <nav aria-label={t("label")} className="grid gap-0.5">
      {sectionsFor(me.role).map((s) => {
        const item = NAV[s];
        const current = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
        const n = item.badge ? (counts.data?.[item.badge] ?? 0) : 0;
        const IconCmp = item.icon;
        return (
          <Link
            key={s}
            href={item.href}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-2.5 rounded-pill px-3 text-[14px] leading-none font-semibold no-underline hover:bg-surface-raised hover:text-text lg:h-11",
              current ? "bg-surface-raised text-text" : "bg-transparent text-text-muted",
            )}
          >
            <IconCmp aria-hidden size={18} />
            <span className="flex-1 text-left">{t(s)}</span>
            {n > 0 &&
              (item.alert ? (
                <span className="box-border grid h-5 min-w-5 place-items-center rounded-pill bg-accent px-1.5 font-mono text-[11px] leading-none font-semibold text-on-accent">
                  {n}
                </span>
              ) : (
                <span className="font-mono text-[12px] leading-none font-medium text-text-muted">
                  {n}
                </span>
              ))}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ me }: { me: Me }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await api("POST", "/admin/logout");
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };
  return (
    <div className="flex items-center gap-2.5 border-t border-line p-2 pt-4">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-pill bg-surface-raised text-[13px] leading-none font-bold"
      >
        {initials(me.name)}
      </span>
      <span className="grid min-w-0 flex-1 gap-[3px]">
        <span className="truncate text-[14px] leading-none font-semibold">{me.name}</span>
        <span className="text-[12px] leading-none text-text-muted">{t(`roles.${me.role}`)}</span>
      </span>
      <IconButton label={t("nav.signOut")} variant="ghost" onClick={signOut} disabled={busy}>
        <SignOutIcon aria-hidden size={18} />
      </IconButton>
    </div>
  );
}

function GameLink() {
  const t = useTranslations("admin.nav");
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className="flex h-12 items-center gap-2.5 rounded-pill px-3 text-[14px] leading-none font-semibold text-text-muted no-underline hover:bg-surface-raised hover:text-text lg:h-11"
    >
      <ArrowSquareOutIcon aria-hidden size={18} />
      {t("openGame")}
    </a>
  );
}

function Brand({ size }: { size: number }) {
  const t = useTranslations("admin");
  return (
    <span className="flex items-center gap-2.5 px-2">
      <Wordmark size={size} />
      <span className="font-mono text-[12px] leading-none font-medium text-text-muted">
        {t("badge")}
      </span>
    </span>
  );
}

/**
 * Console frame from design/SPIL Admin.dc.html: 248 px sidebar (brand, 8 sections with badges,
 * game link, admin card with sign out) from lg; a top bar with a menu sheet on phones.
 */
export function ConsoleShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const t = useTranslations("admin.nav");
  const [menu, setMenu] = useState(false);
  return (
    <MeContext value={me}>
      <div className="flex min-h-[100dvh] bg-bg text-text lg:h-[100dvh] lg:overflow-hidden">
        <aside className="hidden w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-3.5 py-5 lg:flex">
          <Brand size={26} />
          <Nav me={me} />
          <GameLink />
          <div className="mt-auto grid gap-3">
            <Account me={me} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="sticky top-0 flex items-center gap-2 border-b border-line bg-surface px-4 py-2 lg:hidden"
            style={{ zIndex: "var(--z-sticky)" }}
          >
            <Brand size={24} />
            <span className="flex-1" />
            <IconButton label={t("menu")} onClick={() => setMenu(true)}>
              <ListIcon aria-hidden size={20} />
            </IconButton>
          </header>
          <main
            id="admin-main"
            className="box-border flex min-w-0 flex-1 flex-col gap-[22px] px-4 py-6 lg:overflow-auto lg:px-[clamp(20px,3vw,40px)] lg:py-7"
          >
            {children}
          </main>
        </div>
      </div>
      <Sheet open={menu} onOpenChange={setMenu} title={t("menu")} hideTitle>
        <Nav me={me} onNavigate={() => setMenu(false)} />
        <GameLink />
        <Account me={me} />
      </Sheet>
    </MeContext>
  );
}
