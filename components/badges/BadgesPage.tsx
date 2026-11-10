"use client";

import { CheckIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SavePrompt } from "@/components/account/SavePrompt";
import { Avatar } from "@/components/brand/Avatar";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { Badges } from "@/lib/api/achievements";
import { api, ensureSession } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { FRAMES, LOOKS, type FrameId, type LookId } from "@/lib/game";

const LOOK_CLASS: Record<LookId, string> = {
  night: "bg-bg",
  raised: "bg-surface-raised",
  accent: "bg-accent-soft",
};

/**
 * Your badges (Batch 3, free): milestones with progress, and the avatar frames and share card
 * looks they unlock. Kept with this device, no sign up.
 */
export function BadgesPage() {
  const t = useTranslations("badges");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      await ensureSession();
      return api<Badges>("GET", "/me/badges");
    },
  });
  if (q.error) return <ErrorScreen variant="server" onRetry={() => q.refetch()} />;
  const b = q.data;
  if (!b)
    return (
      <main className="mx-auto box-border flex w-full max-w-[720px] flex-1 flex-col gap-8 px-5 pt-6 pb-10">
        <SkeletonGroup label={t("title")} className="gap-3">
          <Skeleton className="h-10 w-56 rounded-input" />
          <Skeleton className="h-5 w-32 rounded-input" />
          <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-card" />
            ))}
          </div>
        </SkeletonGroup>
      </main>
    );

  const choose = async (body: { frame?: FrameId; look?: LookId }) => {
    try {
      qc.setQueryData(["badges"], await api<Badges>("PATCH", "/me/cosmetics", body));
      toast(tt("cosmeticSaved"));
    } catch {
      toast(tt("somethingWrong"), "err");
    }
  };
  const earned = b.achievements.filter((a) => a.unlocked).length;
  const badgeName = (id: string | null) => (id ? t(`list.${id as "first_spill"}.name`) : "");

  return (
    <main className="mx-auto box-border flex w-full max-w-[720px] flex-1 flex-col gap-8 px-5 pt-6 pb-10">
      <div className="grid gap-2">
        <h1 className="m-0 font-display text-display-m leading-[1] font-extrabold tracking-display">
          {t("title")}
        </h1>
        <p className="m-0 text-[16px] leading-[1.5] text-text-muted">
          {t("earned", { n: earned, total: b.achievements.length })}
        </p>
      </div>
      {earned > 0 && <SavePrompt reason="badge" />}
      {/* Nothing earned yet: the way to the first badge comes before the list of locked ones. */}
      {earned === 0 && (
        <div className="grid justify-items-start gap-3 rounded-card border border-line bg-surface p-5">
          <p className="m-0 text-[16px] leading-[1.45] font-semibold">{t("emptyTitle")}</p>
          <Link
            href="/create"
            className="flex h-12 items-center justify-center rounded-pill bg-accent px-6 text-[16px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent active:scale-[.97]"
          >
            {t("emptyCta")}
          </Link>
        </div>
      )}

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-0">
        {b.achievements.map((a) => (
          <li
            key={a.id}
            className={cn(
              "grid grid-rows-[auto_1fr_auto] gap-2 rounded-card border p-4",
              a.unlocked ? "border-accent bg-accent-soft" : "border-line bg-surface",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-[19px] leading-[1.1] font-extrabold">
                {t(`list.${a.id}.name`)}
              </span>
              {a.unlocked ? (
                <CheckIcon
                  size={20}
                  aria-label={t("unlockedLabel")}
                  className="shrink-0 text-accent-ink"
                />
              ) : (
                <LockSimpleIcon
                  size={18}
                  aria-label={t("lockedLabel")}
                  className="shrink-0 text-text-muted"
                />
              )}
            </span>
            <span className="text-[14px] leading-[1.4] text-text-muted">
              {t(`list.${a.id}.body`)}
            </span>
            {!a.unlocked && (
              <span className="grid gap-1.5">
                <span className="h-1.5 rounded-pill bg-surface-raised">
                  <span
                    className="block h-1.5 rounded-pill bg-text"
                    style={{ width: `${(a.progress / a.target) * 100}%` }}
                  />
                </span>
                <span className="font-mono text-[12px] leading-none text-text-muted">
                  {t("progress", { n: a.progress, total: a.target })}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>

      <section className="grid gap-3">
        <h2 className="m-0 font-display text-[24px] leading-none font-extrabold">
          {t("framesTitle")}
        </h2>
        <div role="radiogroup" aria-label={t("framesTitle")} className="flex flex-wrap gap-3">
          {FRAMES.map((f) => {
            const open = b.frames.includes(f.id);
            const on = b.equipped.frame === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={!open || undefined}
                onClick={() => open && !on && choose({ frame: f.id })}
                className={cn(
                  "grid w-[108px] justify-items-center gap-2 rounded-card border p-3 text-center",
                  on ? "border-accent bg-accent-soft" : "border-line bg-surface",
                  !open && "opacity-50",
                )}
              >
                <Avatar n={4} size={48} frame={f.id} decorative />
                <span className="text-[13px] leading-[1.2] font-semibold">
                  {t(`frames.${f.id}`)}
                </span>
                {!open && (
                  <span className="text-[11px] leading-[1.2] text-text-muted">
                    {t("unlockWith", { badge: badgeName(f.unlock) })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 font-display text-[24px] leading-none font-extrabold">
          {t("looksTitle")}
        </h2>
        <div role="radiogroup" aria-label={t("looksTitle")} className="flex flex-wrap gap-3">
          {LOOKS.map((l) => {
            const open = b.looks.includes(l.id);
            const on = b.equipped.look === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={!open || undefined}
                onClick={() => open && !on && choose({ look: l.id })}
                className={cn(
                  "grid w-[140px] gap-2 rounded-card border p-3 text-left",
                  on ? "border-accent" : "border-line",
                  !open && "opacity-50",
                )}
              >
                <span
                  className={cn("block h-20 rounded-input border border-line", LOOK_CLASS[l.id])}
                />
                <span className="text-[13px] leading-[1.2] font-semibold">
                  {t(`looks.${l.id}`)}
                </span>
                {!open && (
                  <span className="text-[11px] leading-[1.2] text-text-muted">
                    {t("unlockWith", { badge: badgeName(l.unlock) })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      <p className="m-0 text-[13px] leading-[1.45] text-text-muted">{t("deviceNote")}</p>
    </main>
  );
}
