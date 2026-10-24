"use client";

import { FastForwardIcon, LockSimpleIcon } from "@phosphor-icons/react";
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

type Chip = "all" | "active" | "stuck" | "finished" | "closed";

export function RoomsSection() {
  const t = useTranslations("admin.rooms");
  const tm = useTranslations("modes");
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
        (chip === "stuck" && r.stuck) ||
        (chip === "closed"
          ? r.status === "closed"
          : chip === "finished"
            ? r.status === "revealed"
            : chip === "active" && r.status !== "closed" && r.status !== "revealed")),
  );
  const shown = paging.slice(rows);

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
        items={(["all", "active", "stuck", "finished", "closed"] as const).map((c) => ({
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
            { label: t("cols.pack"), noPhone: true },
            { label: t("cols.mode"), noPhone: true },
            { label: t("cols.host"), wide: true },
            { label: t("cols.players"), width: 90, right: true, noPhone: true },
            { label: t("cols.status"), width: 130 },
            { label: t("cols.started"), width: 120, noPhone: true },
          ]}
          empty={rows.length === 0}
          emptyText={t("empty")}
          total={rows.length}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
        >
          {shown.map((r) => (
            <Tr key={r.id}>
              <Td mono bold>
                {r.code}
              </Td>
              <Td nowrap noPhone>
                {r.packName}
              </Td>
              <Td nowrap noPhone>
                {tm(`${r.mode as "classic"}.name`)}
              </Td>
              <Td wide nowrap muted={!r.hostNickname}>
                {r.hostNickname ?? t("hostLeft")}
              </Td>
              <Td mono right noPhone>
                {r.players}
              </Td>
              <Td nowrap>
                <StatusLabel status={r.status} />
                {r.stuck && (
                  <span
                    title={t("stuckHint")}
                    className="ml-2 rounded-pill bg-surface-raised px-2 py-1 align-middle text-[12px] leading-none font-semibold text-text-muted"
                  >
                    {t("stuck")}
                  </span>
                )}
              </Td>
              <Td muted nowrap noPhone>
                {ago(r.createdAt)}
              </Td>
              <ActionsTd>
                {(r.status === "answering" || r.status === "guessing" || r.status === "ready") && (
                  <RowAction
                    icon={FastForwardIcon}
                    label={t("advance")}
                    onClick={() =>
                      setConfirm({
                        title: t("advanceTitle", { code: r.code }),
                        body: t("advanceBody"),
                        cta: t("advanceCta"),
                        run: async () => {
                          await run(() => adminApi("POST", `/rooms/${r.id}/advance`), {
                            ok: t("advanced", { code: r.code }),
                          });
                        },
                      })
                    }
                  />
                )}
                {r.status !== "closed" && (
                  <RowAction
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
