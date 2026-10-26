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
  useAdminPage,
  useAgo,
  usePaging,
  useUrlChip,
  useUrlSearch,
  type ConfirmState,
} from "@/components/admin/ui";
import type { AdminRoom } from "@/lib/admin/types";

type Chip = "all" | "active" | "stuck" | "finished" | "closed";
const CHIPS = ["all", "active", "stuck", "finished", "closed"] as const;

export function RoomsSection() {
  const t = useTranslations("admin.rooms");
  const tm = useTranslations("modes");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const run = useAdminAction();
  const ago = useAgo();
  const paging = usePaging();
  const search = useUrlSearch();
  const [chip, setChip] = useUrlChip<Chip>("status", "all", CHIPS);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  // Filtered and paged on the server, so every room is reachable however many there are.
  const q = useAdminPage<AdminRoom>("/rooms", {
    page: paging.page,
    size: paging.size,
    status: chip,
    q: search.debounced.trim() || undefined,
  });
  const data = q.data;

  return (
    <>
      <PageHeader title={tn("rooms")}>
        <SearchBox value={search.value} onChange={search.onChange} placeholder={t("searchPh")} />
      </PageHeader>
      <Chips<Chip>
        label={tn("rooms")}
        value={chip}
        onChange={setChip}
        items={CHIPS.map((c) => ({
          value: c,
          label: t(`chips.${c}`),
        }))}
      />
      {q.isError && !data ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !data ? (
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
          empty={data.total === 0}
          emptyText={t("empty")}
          total={data.total}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
          onSize={paging.setSize}
          busy={q.isPlaceholderData}
        >
          {data.rows.map((r) => (
            <Tr key={r.id}>
              <Td mono bold>
                {r.code}
              </Td>
              <Td noPhone>{r.packName}</Td>
              <Td noPhone>{tm(`${r.mode as "classic"}.name`)}</Td>
              <Td wide muted={!r.hostNickname}>
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
