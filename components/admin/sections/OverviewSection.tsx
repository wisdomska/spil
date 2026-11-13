"use client";

import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  FlagIcon,
  GameControllerIcon,
  MegaphoneSimpleIcon,
  ProhibitIcon,
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
import { Tooltip } from "@/components/ui/Tooltip";
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
  const usersHref = canSee(me.role, "users") ? "/admin/users" : undefined;
  const tm = useTranslations("modes");

  const exportCsv = () => {
    if (!d) return;
    downloadText("spil-stats.csv", statsToCsv(d.days));
    toast(t("exported", { days: d.days.length }));
  };

  const rate = d ? completionRate(d.week.gamesStarted, d.week.gamesFinished) : null;
  const tiles = d
    ? [
        {
          label: t("playingNow"),
          value: d.playingNow,
          note: t("playingNowNote", { rooms: d.liveRooms }),
          href: roomsHref,
        },
        {
          label: t("gamesToday"),
          value: d.today.gamesStarted,
          note: t("gamesTodayNote", { finished: d.today.gamesFinished, active: d.liveRooms }),
          href: roomsHref,
        },
        {
          label: t("captchaFailures"),
          value: d.captchaFailures,
          note: d.captchaFailures ? t("captchaFailuresNote") : t("captchaFailuresNone"),
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
        {
          label: t("banned"),
          value: d.banned,
          note: t("bannedNote"),
          href: usersHref && `${usersHref}?filter=banned`,
        },
      ]
    : [];
  // Switches that change what players see right now, so no admin forgets one is on.
  const live = d
    ? [
        d.noticeOn && { icon: MegaphoneSimpleIcon, text: t("liveNotice"), href: "/admin/settings" },
        d.gamesOff > 0 && {
          icon: GameControllerIcon,
          text: t("liveGamesOff", { n: d.gamesOff }),
          href: "/admin/settings",
        },
        d.banned > 0 &&
          usersHref && {
            icon: ProhibitIcon,
            text: t("liveBanned", { n: d.banned }),
            href: `${usersHref}?filter=banned`,
          },
      ].filter((x): x is { icon: typeof FlagIcon; text: string; href: string } => !!x)
    : [];
  const maxMode = Math.max(1, ...(d?.modePlays.map((p) => p.started) ?? []));
  const maxPlays = Math.max(1, ...(d?.packPlays.map((p) => p.started) ?? []));
  const plays = d?.packPlays.filter((p) => p.started > 0) ?? [];

  return (
    <>
      <PageHeader title={tn("overview")}>
        <OutlineButton onClick={exportCsv} disabled={!d}>
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
          {live.length > 0 && (
            <ul aria-label={t("liveTitle")} className="m-0 flex list-none flex-wrap gap-2 p-0">
              {live.map((l) => (
                <li key={l.text}>
                  <Link
                    href={l.href}
                    className="inline-flex h-10 items-center gap-2 rounded-pill border border-accent bg-accent-soft px-4 text-[14px] leading-none font-semibold text-accent-ink no-underline hover:text-text"
                  >
                    <l.icon aria-hidden size={16} weight="bold" />
                    {l.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {/* Hairlines between tiles come from the 1 px gap over the line colour. */}
          <section className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
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
                i === tiles.length - 1 && tiles.length % 2 === 1 && "col-span-2",
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
          <Trend days={d.days} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5">
            <Panel className="grid content-start gap-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="m-0 text-[17px] leading-none font-bold">{t("perMode")}</h2>
                <span className="font-mono text-[12px] leading-none text-text-muted">
                  {t("perPackNote")}
                </span>
              </div>
              {d.modePlays.length === 0 ? (
                <span className="py-2.5 text-[14px] leading-[1.4] text-text-muted">
                  {t("perPackEmpty")}
                </span>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {d.modePlays.map((p) => (
                    <li
                      key={p.mode}
                      className="grid grid-cols-[minmax(0,120px)_1fr_40px] items-center gap-3 text-[14px] leading-none font-medium sm:grid-cols-[170px_1fr_48px]"
                    >
                      <span className="truncate">
                        {tm.has(`${p.mode}.name`) ? tm(`${p.mode}.name`) : p.mode}
                      </span>
                      <span
                        aria-hidden
                        className="h-2 overflow-hidden rounded-pill bg-surface-raised"
                      >
                        <span
                          className="block h-2 rounded-pill bg-accent"
                          style={{ width: `${(p.started / maxMode) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-mono text-[13px]">{p.started}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
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
              {d.openReports === 0 && (
                <span className="flex items-center gap-2.5 py-2.5 text-[14px] leading-[1.4] text-text-muted">
                  <CheckCircleIcon aria-hidden size={18} className="text-success" />
                  {t("quiet")}
                </span>
              )}
              {/* Reports about players and written answers have no question to list. */}
              {d.flagged.length === 0 && d.openReports > 0 && reportsHref && (
                <Link
                  href={reportsHref}
                  className="flex min-h-12 items-center gap-3 border-b border-line py-2.5 text-[14px] leading-[1.4] text-text no-underline hover:bg-surface-raised hover:text-text"
                >
                  <FlagIcon aria-hidden size={18} className="shrink-0 text-error" />
                  {t("openReportsRow", { count: d.openReports })}
                </Link>
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

/**
 * Games started and finished per day for the last 30 days (oldest on the left). One accent for
 * started, the muted line colour for finished inside it. Screen readers get the same numbers as
 * a table; the bars are decoration for them.
 */
function Trend({ days }: { days: Overview["days"] }) {
  const t = useTranslations("admin.overview");
  const ordered = [...days].reverse();
  const max = Math.max(1, ...ordered.map((d) => d.gamesStarted));
  const total = ordered.reduce((n, d) => n + d.gamesStarted, 0);
  const label = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <Panel className="grid gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] leading-none font-bold">{t("trendTitle")}</h2>
        <span className="flex items-center gap-4 font-mono text-[12px] leading-none text-text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-accent" />
            {t("trendStarted")}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-text-muted" />
            {t("trendFinished")}
          </span>
        </span>
      </div>
      {total === 0 ? (
        <span className="text-[14px] text-text-muted">{t("trendEmpty")}</span>
      ) : (
        <>
          <div aria-hidden className="flex h-40 items-end gap-[3px] border-b border-line">
            {ordered.map((d) => (
              <Tooltip
                key={d.day}
                content={t("trendTip", {
                  day: label(d.day),
                  started: d.gamesStarted,
                  finished: d.gamesFinished,
                })}
              >
                <span className="relative flex h-full min-w-0 flex-1 items-end rounded-t-[3px] hover:bg-surface-raised">
                  <span
                    className="relative w-full rounded-t-[3px] bg-accent"
                    style={{ height: `${(d.gamesStarted / max) * 100}%` }}
                  >
                    <span
                      className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-text-muted/60"
                      style={{
                        height: `${d.gamesStarted ? (d.gamesFinished / d.gamesStarted) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </span>
              </Tooltip>
            ))}
          </div>
          <div
            aria-hidden
            className="flex justify-between font-mono text-[12px] leading-none text-text-muted"
          >
            <span>{label(ordered[0]!.day)}</span>
            <span>{label(ordered[ordered.length - 1]!.day)}</span>
          </div>
          <table className="sr-only">
            <caption>{t("trendTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("trendDay")}</th>
                <th scope="col">{t("trendStarted")}</th>
                <th scope="col">{t("trendFinished")}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((d) => (
                <tr key={d.day}>
                  <th scope="row">{label(d.day)}</th>
                  <td>{d.gamesStarted}</td>
                  <td>{d.gamesFinished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
