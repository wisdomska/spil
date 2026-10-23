"use client";

import { LockSimpleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ActionsTd,
  adminApi,
  Chips,
  ConfirmDialog,
  DataTable,
  LoadError,
  PageHeader,
  RowAction,
  SearchBox,
  StatusLabel,
  TableSkeleton,
  Td,
  Tr,
  useAdminAction,
  useAdminQuery,
  useAgo,
  usePaging,
  type ConfirmState,
} from "@/components/admin/ui";
import type { AdminRoom } from "@/lib/admin/types";

type Chip = "all" | "active" | "finished" | "closed";

export function RoomsSection() {
  const t = useTranslations("admin.rooms");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const q = useAdminQuery<AdminRoom[]>("/rooms");
  const run = useAdminAction();
  const ago = useAgo();
  const paging = usePaging();
  const [chip, setChip] = useState<Chip>("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const sq = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (r) =>
      (!sq || r.code.toLowerCase().includes(sq)) &&
      (chip === "all" ||
        (chip === "closed"
          ? r.status === "closed"
          : chip === "finished"
            ? r.status === "revealed"
            : r.status !== "closed" && r.status !== "revealed")),
  );
  const shown = rows.slice(0, paging.limit);

  return (
    <>
      <PageHeader title={tn("rooms")}>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            paging.reset();
          }}
          placeholder={t("searchPh")}
        />
      </PageHeader>
      <Chips<Chip>
        label={tn("rooms")}
        value={chip}
        onChange={(c) => {
          setChip(c);
          paging.reset();
        }}
        items={(["all", "active", "finished", "closed"] as const).map((c) => ({
          value: c,
          label: t(`chips.${c}`),
        }))}
      />
      {q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("rooms")}
          cols={[
            { label: t("cols.code"), width: 90 },
            { label: t("cols.pack") },
            { label: t("cols.host"), wide: true },
            { label: t("cols.players"), width: 90, right: true },
            { label: t("cols.status"), width: 130 },
            { label: t("cols.started"), width: 120 },
          ]}
          empty={rows.length === 0}
          emptyText={t("empty")}
          total={rows.length}
          shown={shown.length}
          onMore={paging.more}
        >
          {shown.map((r) => (
            <Tr key={r.id}>
              <Td mono bold>
                {r.code}
              </Td>
              <Td nowrap>{r.packName}</Td>
              <Td wide nowrap muted={!r.hostNickname}>
                {r.hostNickname ?? t("hostLeft")}
              </Td>
              <Td mono right>
                {r.players}
              </Td>
              <Td nowrap>
                <StatusLabel status={r.status} />
              </Td>
              <Td muted nowrap>
                {ago(r.createdAt)}
              </Td>
              <ActionsTd>
                {r.status !== "closed" && (
                  <RowAction
                    danger
                    icon={LockSimpleIcon}
                    label={t("close")}
                    onClick={() =>
                      setConfirm({
                        title: t("closeTitle", { code: r.code }),
                        body: t("closeBody"),
                        cta: t("closeCta"),
                        run: async () => {
                          await run(() => adminApi("POST", `/rooms/${r.id}/close`), {
                            ok: t("closed", { code: r.code }),
                          });
                        },
                      })
                    }
                  />
                )}
              </ActionsTd>
            </Tr>
          ))}
        </DataTable>
      )}
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </>
  );
}
