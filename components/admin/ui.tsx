"use client";

import {
  ArchiveIcon,
  CheckCircleIcon,
  EnvelopeOpenIcon,
  EnvelopeSimpleIcon,
  EyeSlashIcon,
  FlagIcon,
  HandSwipeRightIcon,
  HourglassIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
  UsersThreeIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ClientApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ErrorLine } from "./fields";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** GET an admin endpoint through TanStack Query. A lost session goes back to the sign-in page. */
export function useAdminQuery<T>(path: string, enabled = true) {
  const router = useRouter();
  return useQuery<T, ClientApiError>({
    queryKey: ["admin", path],
    enabled,
    queryFn: async () => {
      try {
        return await api<T>("GET", `/admin${path}`);
      } catch (e) {
        if (e instanceof ClientApiError && e.status === 401) router.replace("/admin/login");
        throw e;
      }
    },
    refetchInterval: 30_000,
  });
}

/**
 * Runs a write, refreshes every admin query (badges included) and maps API error codes to
 * console copy. Returns the error code (or null on success) so forms can show it inline.
 */
export function useAdminAction() {
  const t = useTranslations("admin.common");
  const toast = useToast();
  const client = useQueryClient();
  const router = useRouter();
  return useCallback(
    async <T,>(
      call: () => Promise<T>,
      opts: { ok?: string; errors?: Record<string, string>; quiet?: boolean } = {},
    ): Promise<{ data?: T; code: string | null; message: string | null; raw?: string }> => {
      try {
        const data = await call();
        if (opts.ok) toast(opts.ok);
        await client.invalidateQueries({ queryKey: ["admin"] });
        return { data, code: null, message: null };
      } catch (e) {
        const code = e instanceof ClientApiError ? e.code : "INTERNAL";
        const raw = e instanceof Error ? e.message : undefined;
        if (code === "UNAUTHENTICATED") {
          router.replace("/admin/login");
          return { code, message: null, raw };
        }
        const message =
          opts.errors?.[code] ??
          (code === "FORBIDDEN"
            ? t("forbidden")
            : code === "RATE_LIMITED"
              ? t("rateLimited")
              : t("somethingWrong"));
        if (!opts.quiet) toast(message, "err");
        return { code, message, raw };
      }
    },
    [client, router, t, toast],
  );
}

export const adminApi = <T,>(method: string, path: string, body?: unknown) =>
  api<T>(method, `/admin${path}`, body);

/** Saves text as a file in the browser. */
export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export function useAgo() {
  const t = useTranslations("admin.common");
  return (iso: string) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return t("justNow");
    if (s < 3600) return t("minAgo", { n: Math.floor(s / 60) });
    if (s < 86400) return t("hAgo", { n: Math.floor(s / 3600) });
    return t("dAgo", { n: Math.floor(s / 86400) });
  };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 23 14:05" in the viewer's time zone (design WHEN). */
export function when(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MON[d.getMonth()]} ${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

/** Section title row with search and actions on the right (wraps on phones). */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.03em]">
        {title}
      </h1>
      {children && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{children}</div>}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const t = useTranslations("admin.common");
  return (
    <label className="box-border flex h-12 w-full items-center gap-2 rounded-input border-[1.5px] border-line-strong bg-surface px-3.5 text-text-muted focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)] hover:border-text-muted sm:w-[260px]">
      <MagnifyingGlassIcon aria-hidden size={18} className="shrink-0" />
      <input
        type="search"
        aria-label={t("search")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text shadow-none outline-none focus:shadow-none"
      />
    </label>
  );
}

/** Outline pill used for Export CSV and other secondary header actions. */
export function OutlineButton({
  className,
  danger,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-pill border-[1.5px] bg-transparent px-4 text-[15px] leading-none font-semibold whitespace-nowrap active:scale-[.97]",
        danger
          ? "border-error text-error hover:bg-accent-soft"
          : "border-line text-text hover:bg-surface-raised",
        className,
      )}
      {...rest}
    />
  );
}

type Chip<T extends string> = { value: T; label: string };

/** Filter chips (design role="tablist" pills). */
export function Chips<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<Chip<T>>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 flex shrink-0 [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0"
    >
      {items.map((c) => {
        const sel = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onChange(c.value)}
            className={cn(
              "relative h-10 rounded-pill border-[1.5px] px-4 text-[14px] leading-none font-semibold whitespace-nowrap after:absolute after:-inset-1 after:content-[''] hover:border-text",
              sel
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-transparent text-text",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-card border border-line bg-surface", className)}>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/** Columns flagged `wide` show from 1100 px, like the design's narrow layout. */
export const WIDE = "hidden min-[1100px]:table-cell";
/** Columns flagged `noPhone` hide below 640 px so the row fits a phone without sideways scroll. */
export const NO_PHONE = "max-sm:hidden";

export type Col = {
  label: string;
  width?: number;
  right?: boolean;
  wide?: boolean;
  noPhone?: boolean;
};

export function DataTable({
  cols,
  children,
  empty,
  emptyText,
  total,
  shown,
  onMore,
  caption,
}: {
  cols: Col[];
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
  total: number;
  shown: number;
  onMore: () => void;
  caption: string;
}) {
  const t = useTranslations("admin.common");
  return (
    <div className="overflow-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-[14px] leading-[1.35]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                scope="col"
                style={{ width: c.width }}
                className={cn(
                  "sticky top-0 z-[1] bg-surface-raised px-2.5 py-3 font-mono text-[12px] leading-none font-semibold whitespace-nowrap text-text-muted min-[1100px]:px-3.5",
                  c.right ? "text-right" : "text-left",
                  c.wide && WIDE,
                  c.noPhone && NO_PHONE,
                )}
              >
                {c.label}
              </th>
            ))}
            <th scope="col" className="sticky top-0 z-[1] w-px bg-surface-raised">
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {total > shown && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-3">
          <span className="font-mono text-[13px] leading-none text-text-muted">
            {t("showing", { shown, total })}
          </span>
          <OutlineButton onClick={onMore}>{t("showMore", { count: total - shown })}</OutlineButton>
        </div>
      )}
      {empty && (
        <div className="px-5 py-10 text-center text-[15px] leading-[1.5] text-text-muted">
          {emptyText}
        </div>
      )}
    </div>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-line transition-colors duration-[120ms] hover:bg-accent-soft">
      {children}
    </tr>
  );
}

export function Td({
  children,
  mono,
  muted,
  bold,
  right,
  nowrap,
  wide,
  noPhone,
  className,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  bold?: boolean;
  right?: boolean;
  nowrap?: boolean;
  wide?: boolean;
  noPhone?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-3 align-middle min-[1100px]:px-3.5",
        mono ? "font-mono text-[13px] leading-[1.3] font-medium" : "text-[14px] leading-[1.4]",
        muted ? "text-text-muted" : "text-text",
        bold && "font-semibold",
        right ? "text-right" : "text-left",
        nowrap && "whitespace-nowrap",
        wide && WIDE,
        noPhone && NO_PHONE,
        className,
      )}
    >
      {children}
    </td>
  );
}

export function ActionsTd({ children }: { children?: React.ReactNode }) {
  return <td className="py-2 pr-2.5 text-right whitespace-nowrap">{children}</td>;
}

/**
 * Row action: text pill from 1100 px, a 40 px icon button below (design `ab`). The hit area is
 * padded to 48 px either way.
 */
export function RowAction({
  label,
  icon: IconCmp,
  onClick,
  danger,
}: {
  label: string;
  icon: Icon;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative ml-1 inline-grid size-10 place-items-center rounded-pill border-[1.5px] bg-transparent align-middle text-[13px] leading-none font-semibold after:absolute after:-inset-1 after:content-[''] hover:bg-surface-raised active:scale-[.97]",
        "min-[1100px]:ml-1.5 min-[1100px]:inline-flex min-[1100px]:h-9 min-[1100px]:w-auto min-[1100px]:px-3.5",
        danger ? "border-error text-error" : "border-line text-text",
      )}
    >
      <IconCmp aria-hidden size={18} className="min-[1100px]:hidden" />
      <span aria-hidden className="hidden min-[1100px]:inline">
        {label}
      </span>
    </button>
  );
}

const STATUS_ICON: Record<string, Icon> = {
  live: CheckCircleIcon,
  draft: PencilSimpleIcon,
  hidden: EyeSlashIcon,
  open: FlagIcon,
  dismissed: XCircleIcon,
  actioned: EyeSlashIcon,
  new: EnvelopeSimpleIcon,
  read: EnvelopeOpenIcon,
  archived: ArchiveIcon,
  lobby: UsersThreeIcon,
  answering: HandSwipeRightIcon,
  guessing: SlidersHorizontalIcon,
  ready: HourglassIcon,
  revealed: TrophyIcon,
  closed: LockSimpleIcon,
};

export function StatusLabel({ status }: { status: string }) {
  const t = useTranslations("admin.status");
  const IconCmp = STATUS_ICON[status];
  return (
    <span className="inline-flex items-center gap-1.5 align-middle whitespace-nowrap">
      {IconCmp && <IconCmp aria-hidden size={16} className="shrink-0" />}
      {t.has(status) ? t(status) : status}
    </span>
  );
}

/** Table loading state: breathing rows, never a spinner. */
export function TableSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label} className="gap-2 rounded-card border border-line bg-surface p-3">
      <Skeleton className="h-9 rounded-input" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12 rounded-input" />
      ))}
    </SkeletonGroup>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("admin.common");
  return (
    <Panel className="grid justify-items-center gap-4 px-5 py-10 text-center">
      <span className="text-[15px] text-text-muted">{t("loadFailed")}</span>
      <OutlineButton onClick={onRetry}>{t("retry")}</OutlineButton>
    </Panel>
  );
}

/** Client-side paging for long tables (design "Show more", 40 rows at a time). */
export function usePaging(step = 40) {
  const [limit, setLimit] = useState(step);
  return {
    limit,
    more: () => setLimit((l) => l + step),
    reset: () => setLimit(step),
  };
}

// ---------------------------------------------------------------------------
// Dialogs (the existing Sheet: bottom sheet on phones, centred modal from lg)
// ---------------------------------------------------------------------------

export function FormDialog({
  open,
  onClose,
  title,
  onSubmit,
  error,
  busy,
  onDelete,
  submitLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void;
  error?: string | null;
  busy?: boolean;
  onDelete?: () => void;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin.common");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      closeButton
      className="lg:w-[520px]"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit();
        }}
        className="grid gap-4"
      >
        {children}
        <ErrorLine>{error}</ErrorLine>
        <div className="mt-1 flex items-center gap-2.5">
          {onDelete && (
            <OutlineButton danger onClick={onDelete}>
              {t("delete")}
            </OutlineButton>
          )}
          <span className="flex-1" />
          <Button variant="ghost" size="md" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" size="md" loading={busy} className="px-[22px]">
            {submitLabel ?? t("save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export type ConfirmState = {
  title: string;
  body: React.ReactNode;
  cta: string;
  /** The confirmed action. It may return a follow-up notice (e.g. a temporary password). */
  run?: () => Promise<ConfirmState | void> | void;
} | null;

/** Destructive confirmation (design alertdialog). Without `run` it is a plain notice. */
export function ConfirmDialog({
  state,
  setState,
}: {
  state: ConfirmState;
  setState: (next: ConfirmState) => void;
}) {
  const t = useTranslations("admin.common");
  const [busy, setBusy] = useState(false);
  const onClose = () => setState(null);
  return (
    <Sheet
      open={!!state}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={state?.title ?? ""}
      description={state?.body}
    >
      <div className="mt-1 flex justify-end gap-2.5">
        {state?.run && (
          <Button variant="ghost" size="md" onClick={onClose} autoFocus>
            {t("cancel")}
          </Button>
        )}
        <Button
          variant={state?.run ? "destructive" : "primary"}
          size="md"
          loading={busy}
          className="px-5"
          onClick={async () => {
            if (!state?.run) return onClose();
            setBusy(true);
            let next: ConfirmState | void = null;
            try {
              next = await state.run();
            } finally {
              setBusy(false);
              setState(next ?? null);
            }
          }}
        >
          {state?.cta}
        </Button>
      </div>
    </Sheet>
  );
}
