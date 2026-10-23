"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ActionsTd,
  DataTable,
  LoadError,
  PageHeader,
  SearchBox,
  TableSkeleton,
  Td,
  Tr,
  useAdminQuery,
  usePaging,
  when,
} from "@/components/admin/ui";
import type { AuditRow } from "@/lib/admin/types";

export function AuditSection() {
  const t = useTranslations("admin.audit");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const q = useAdminQuery<AuditRow[]>("/audit");
  const paging = usePaging(100);
  const [search, setSearch] = useState("");
  const label = (action: string) => (t.has(`actions.${action}`) ? t(`actions.${action}`) : action);
  const sq = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (a) => !sq || `${a.who} ${label(a.action)} ${a.target}`.toLowerCase().includes(sq),
  );
  const shown = rows.slice(0, paging.limit);

  return (
    <>
      <PageHeader title={tn("audit")}>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            paging.reset();
          }}
          placeholder={t("searchPh")}
        />
      </PageHeader>
      <p className="m-0 -mt-2 font-mono text-[13px] leading-none text-text-muted">{t("note")}</p>
      {q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("audit")}
          cols={[
            { label: t("cols.when"), width: 150 },
            { label: t("cols.who"), width: 160 },
            { label: t("cols.action"), width: 180 },
            { label: t("cols.target") },
          ]}
          empty={rows.length === 0}
          emptyText={t("empty")}
          total={rows.length}
          shown={shown.length}
          onMore={paging.more}
        >
          {shown.map((a) => (
            <Tr key={a.id}>
              <Td mono muted nowrap>
                {when(a.at)}
              </Td>
              <Td bold nowrap>
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
