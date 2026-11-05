"use client";

import { useTranslations } from "next-intl";
import {
  Chips,
  DataTable,
  LoadError,
  PageHeader,
  SearchBox,
  TableSkeleton,
  Td,
  Tr,
  useAdminPage,
  useAgo,
  usePaging,
  useUrlChip,
  useUrlSearch,
  when,
} from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import type { AdminUser, AdminUserSummary } from "@/lib/admin/types";

type Chip = "all" | "new" | "active";
const CHIPS = ["all", "new", "active"] as const;

/**
 * Users (owner request 2026-11-05): player accounts with their stats and when they were last
 * seen, and how many guests play without one. Read only; no email addresses exist to show.
 */
export function UsersSection() {
  const t = useTranslations("admin.users");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const ago = useAgo();
  const paging = usePaging();
  const search = useUrlSearch();
  const [chip, setChip] = useUrlChip<Chip>("filter", "all", CHIPS);
  const q = useAdminPage<AdminUser>("/users", {
    page: paging.page,
    size: paging.size,
    filter: chip,
    q: search.debounced.trim() || undefined,
  });
  const data = q.data as (typeof q.data & { summary?: AdminUserSummary }) | undefined;
  const s = data?.summary;

  const tiles = s
    ? [
        { label: t("tiles.accounts"), value: s.accounts, note: t("tiles.accountsNote") },
        {
          label: t("tiles.new"),
          value: s.newAccounts,
          note: t("tiles.newNote"),
        },
        {
          label: t("tiles.active"),
          value: s.activeAccounts,
          note: t("tiles.activeNote"),
        },
        {
          label: t("tiles.guests"),
          value: s.guests,
          note: t("tiles.guestsNote", { n: s.newGuests }),
        },
      ]
    : [];

  return (
    <>
      <PageHeader title={tn("users")}>
        <SearchBox value={search.value} onChange={search.onChange} placeholder={t("searchPh")} />
      </PageHeader>
      {s && (
        // Hairlines between tiles come from the 1 px gap over the line colour.
        <section
          aria-label={t("summary")}
          className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4"
        >
          {tiles.map((tile) => (
            <div key={tile.label} className={cn("grid content-start gap-2.5 bg-surface p-5")}>
              <span className="text-[13px] leading-none font-medium text-text-muted">
                {tile.label}
              </span>
              <span className="font-mono text-[34px] leading-none font-semibold tracking-[-0.03em]">
                {tile.value}
              </span>
              <span className="font-mono text-[12px] leading-[1.3] font-medium text-text-muted">
                {tile.note}
              </span>
            </div>
          ))}
        </section>
      )}
      <Chips<Chip>
        label={tn("users")}
        value={chip}
        onChange={setChip}
        items={CHIPS.map((c) => ({ value: c, label: t(`chips.${c}`) }))}
      />
      {q.isError && !data ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("users")}
          cols={[
            { label: t("cols.username") },
            { label: t("cols.games"), width: 80, right: true },
            { label: t("cols.wins"), width: 80, right: true, noPhone: true },
            { label: t("cols.points"), width: 90, right: true, noPhone: true },
            { label: t("cols.crews"), width: 80, right: true, noPhone: true },
            { label: t("cols.joined"), width: 130, noPhone: true },
            { label: t("cols.lastSeen"), width: 120 },
          ]}
          empty={data.total === 0}
          emptyText={search.debounced.trim() || chip !== "all" ? t("noMatch") : t("empty")}
          total={data.total}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
          onSize={paging.setSize}
          busy={q.isPlaceholderData}
        >
          {data.rows.map((u) => (
            <Tr key={u.userId}>
              <Td bold>{u.username}</Td>
              <Td mono right>
                {u.games}
              </Td>
              <Td mono right noPhone>
                {u.wins}
              </Td>
              <Td mono right noPhone>
                {u.points}
              </Td>
              <Td mono right noPhone>
                {u.crews}
              </Td>
              <Td muted nowrap noPhone>
                {when(u.createdAt)}
              </Td>
              <Td muted nowrap>
                {u.lastSeen ? ago(u.lastSeen) : t("never")}
              </Td>
            </Tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
