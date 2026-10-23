"use client";

import {
  CheckCircleIcon,
  DownloadSimpleIcon,
  EnvelopeSimpleIcon,
  FlagIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMe } from "@/components/admin/ConsoleShell";
import {
  downloadText,
  LoadError,
  OutlineButton,
  PageHeader,
  Panel,
  useAdminQuery,
} from "@/components/admin/ui";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { canSee } from "@/lib/admin/roles";
import { completionRate, statsToCsv } from "@/lib/admin/stats";
import type { Overview } from "@/lib/admin/types";
import { cn } from "@/lib/cn";

const TILE =
  "grid content-start gap-2.5 p-5 text-left text-text no-underline hover:bg-surface-raised hover:text-text";

export function OverviewSection() {
  const t = useTranslations("admin.overview");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const toast = useToast();
  const me = useMe();
  const q = useAdminQuery<Overview>("/overview");
  const d = q.data;
  const roomsHref = canSee(me.role, "rooms") ? "/admin/rooms" : undefined;
  const reportsHref = canSee(me.role, "reports") ? "/admin/reports" : undefined;

  const exportCsv = () => {
    if (!d) return;
    downloadText("spil-stats.csv", statsToCsv(d.days));
    toast(t("exported", { days: d.days.length }));
  };

  const rate = d ? completionRate(d.week.gamesStarted, d.week.gamesFinished) : null;
  const tiles = d
    ? [
        {
          label: t("gamesToday"),
          value: d.today.gamesStarted,
          note: t("gamesTodayNote", { finished: d.today.gamesFinished, active: d.liveRooms }),
          href: roomsHref,
        },
        {
          label: t("gamesWeek"),
          value: d.week.gamesStarted,
          note: t("gamesWeekNote", { finished: d.week.gamesFinished }),
          href: roomsHref,
        },
        {
          label: t("playersToday"),
          value: d.today.joins,
          note: t("playersTodayNote", { week: d.week.joins }),
          href: roomsHref,
        },
        {
          label: t("finished"),
          value: rate === null ? tc("na") : `${rate}%`,
          note: t("finishedNote", {
            finished: d.week.gamesFinished,
            started: d.week.gamesStarted,
          }),
          href: roomsHref,
        },
        {
          label: t("openReports"),
          value: d.openReports,
          note: d.openReports ? t("openReportsNote") : t("openReportsNone"),
          href: reportsHref,
        },
      ]
    : [];
  const maxPlays = Math.max(1, ...(d?.packPlays.map((p) => p.started) ?? []));
  const plays = d?.packPlays.filter((p) => p.started > 0) ?? [];

  return (
    <>
      <PageHeader title={tn("overview")}>
        <OutlineButton onClick={exportCsv} disabled={!d}>
          <DownloadSimpleIcon aria-hidden size={18} />
          {tc("exportCsv")}
        </OutlineButton>
      </PageHeader>
      {q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !d ? (
        <SkeletonGroup label={tc("loading")} className="gap-5">
          <Skeleton className="h-[112px] rounded-card" />
          <div className="grid gap-5 md:grid-cols-2">
            <Skeleton className="h-[240px] rounded-card" />
            <Skeleton className="h-[240px] rounded-card" />
          </div>
        </SkeletonGroup>
      ) : (
        <>
          {/* Hairlines between tiles come from the 1 px gap over the line colour. */}
          <section className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-5">
            {tiles.map((tile, i) => {
              const body = (
                <>
                  <span className="text-[13px] leading-none font-medium text-text-muted">
                    {tile.label}
                  </span>
                  <span className="font-mono text-[34px] leading-none font-semibold tracking-[-0.03em]">
                    {tile.value}
                  </span>
                  <span className="font-mono text-[12px] leading-[1.3] font-medium text-text-muted">
                    {tile.note}
                  </span>
                </>
              );
              const edge = cn(
                "bg-surface",
                i === tiles.length - 1 && tiles.length % 2 === 1 && "max-lg:col-span-2",
              );
              return tile.href ? (
                <Link key={tile.label} href={tile.href} className={cn(TILE, edge)}>
                  {body}
                </Link>
              ) : (
                <div key={tile.label} className={cn(TILE, edge, "hover:bg-surface")}>
                  {body}
                </div>
              );
            })}
          </section>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5">
            <Panel className="grid content-start gap-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="m-0 text-[17px] leading-none font-bold">{t("perPack")}</h2>
                <span className="font-mono text-[12px] leading-none text-text-muted">
                  {t("perPackNote")}
                </span>
              </div>
              {plays.length === 0 ? (
                <span className="py-2.5 text-[14px] leading-[1.4] text-text-muted">
                  {t("perPackEmpty")}
                </span>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {plays.map((p) => (
                    <li
                      key={p.packId}
                      className="grid grid-cols-[minmax(0,120px)_1fr_40px] items-center gap-3 text-[14px] leading-none font-medium sm:grid-cols-[170px_1fr_48px]"
                    >
                      <span className="truncate">{p.name}</span>
                      <span
                        aria-hidden
                        className="h-2 overflow-hidden rounded-pill bg-surface-raised"
                      >
                        <span
                          className="block h-2 rounded-pill bg-accent"
                          style={{ width: `${(p.started / maxPlays) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-mono text-[13px]">{p.started}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="grid content-start gap-1 p-5">
              <h2 className="m-0 mb-2 text-[17px] leading-none font-bold">{t("needsLook")}</h2>
              {d.flagged.length === 0 && (
                <span className="flex items-center gap-2.5 py-2.5 text-[14px] leading-[1.4] text-text-muted">
                  <CheckCircleIcon aria-hidden size={18} className="text-success" />
                  {t("quiet")}
                </span>
              )}
              {d.flagged.map((f) => {
                const row = (
                  <>
                    <FlagIcon aria-hidden size={18} className="mt-0.5 shrink-0 text-error" />
                    <span className="flex-1 text-[14px] leading-[1.4]">
                      {tc("haveYouEver", { text: f.text })}
                    </span>
                    <span className="font-mono text-[12px] leading-none text-text-muted">
                      {f.count}
                    </span>
                  </>
                );
                const cls =
                  "flex min-h-12 items-start gap-3 border-b border-line py-2.5 text-text no-underline";
                return reportsHref ? (
                  <Link
                    key={f.questionId}
                    href={reportsHref}
                    className={cn(cls, "hover:bg-surface-raised hover:text-text")}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={f.questionId} className={cls}>
                    {row}
                  </div>
                );
              })}
              {d.newMessages > 0 && canSee(me.role, "inbox") && (
                <Link
                  href="/admin/inbox"
                  className="flex min-h-12 items-center gap-3 py-2.5 text-[14px] leading-[1.4] text-text no-underline hover:bg-surface-raised hover:text-text"
                >
                  <EnvelopeSimpleIcon aria-hidden size={18} className="shrink-0 text-accent-ink" />
                  {t("newMessages", { count: d.newMessages })}
                </Link>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
