"use client";

import { useTranslations } from "next-intl";
import {
  ActionsTd,
  DataTable,
  LoadError,
  PageHeader,
  SearchBox,
  TableSkeleton,
  Td,
  Tr,
  useAdminPage,
  usePaging,
  useUrlSearch,
  when,
} from "@/components/admin/ui";
import type { AuditRow } from "@/lib/admin/types";

export function AuditSection() {
  const t = useTranslations("admin.audit");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const paging = usePaging(50);
  const search = useUrlSearch();
  const label = (action: string) => (t.has(`actions.${action}`) ? t(`actions.${action}`) : action);
  // The search runs on the server; actions whose label matches are sent along by key.
  const sq = search.debounced.trim().toLowerCase();
  const actionKeys = Object.keys(t.raw("actions") as Record<string, string>);
  const actions = sq ? actionKeys.filter((k) => label(k).toLowerCase().includes(sq)) : [];
  const q = useAdminPage<AuditRow>("/audit", {
    page: paging.page,
    size: paging.size,
    q: sq || undefined,
    actions: actions.length ? actions.join(",") : undefined,
  });
  const data = q.data;

  return (
    <>
      <PageHeader title={tn("audit")}>
        <SearchBox value={search.value} onChange={search.onChange} placeholder={t("searchPh")} />
      </PageHeader>
      <p className="m-0 -mt-2 font-mono text-[13px] leading-none text-text-muted">{t("note")}</p>
      {q.isError && !data ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("audit")}
          cols={[
            { label: t("cols.when"), width: 150, noPhone: true },
            { label: t("cols.who"), width: 160, noPhone: true },
            { label: t("cols.action"), width: 180 },
            { label: t("cols.target") },
          ]}
          empty={data.total === 0}
          emptyText={t("empty")}
          total={data.total}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
          onSize={paging.setSize}
          busy={q.isPlaceholderData}
        >
          {data.rows.map((a) => (
            <Tr key={a.id}>
              <Td mono muted nowrap noPhone>
                {when(a.at)}
              </Td>
              <Td bold nowrap noPhone>
                {a.who}
              </Td>
              <Td nowrap>{label(a.action)}</Td>
              <Td muted className="min-w-[160px] break-words">
                {a.target}
              </Td>
              <ActionsTd />
            </Tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
