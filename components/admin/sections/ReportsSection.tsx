"use client";

import { EyeSlashIcon, UserMinusIcon, XIcon } from "@phosphor-icons/react";
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
  StatusLabel,
  TableSkeleton,
  Td,
  Tr,
  useAdminAction,
  useAdminPage,
  useAgo,
  usePaging,
  useUrlChip,
  type ConfirmState,
} from "@/components/admin/ui";
import type { AdminReport } from "@/lib/admin/types";

type Chip = "open" | "actioned" | "dismissed" | "all";
const CHIPS = ["open", "actioned", "dismissed", "all"] as const;

export function ReportsSection() {
  const t = useTranslations("admin.reports");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const run = useAdminAction();
  const ago = useAgo();
  const paging = usePaging();
  const [chip, setChip] = useUrlChip<Chip>("status", "open", CHIPS);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  // Filtered and paged on the server, so every report is reachable.
  const q = useAdminPage<AdminReport>("/reports", {
    page: paging.page,
    size: paging.size,
    status: chip,
  });
  const data = q.data;

  const subject = (r: AdminReport) => {
    if (r.type === "answer") return t("answer", { text: r.answerText ?? t("deletedAnswer") });
    if (r.type === "nickname" || (!r.questionId && r.playerId))
      return t("nickname", { name: r.playerNickname ?? t("unknownPlayer") });
    if (r.questionId || r.type === "question") return r.questionText ?? t("deletedQuestion");
    return t("other");
  };

  const act = (r: AdminReport, action: "dismiss" | "hide_question" | "remove_player") =>
    run(() => adminApi("POST", `/reports/${r.id}`, { action }), {
      ok:
        action === "dismiss"
          ? t("dismissed")
          : action === "hide_question"
            ? t("questionHidden")
            : t("playerRemoved"),
    });

  return (
    <>
      <PageHeader title={tn("reports")} />
      <Chips<Chip>
        label={tn("reports")}
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
          caption={tn("reports")}
          cols={[
            { label: t("cols.subject") },
            { label: t("cols.reason"), width: 150, noPhone: true },
            { label: t("cols.room"), width: 80, wide: true },
            { label: t("cols.when"), width: 110, wide: true },
            { label: t("cols.status"), width: 110 },
          ]}
          empty={data.total === 0}
          emptyText={chip === "open" ? t("emptyOpen") : t("empty")}
          total={data.total}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
          onSize={paging.setSize}
          busy={q.isPlaceholderData}
        >
          {data.rows.map((r) => (
            <Tr key={r.id}>
              <Td bold className="min-w-[180px]">
                {subject(r)}
              </Td>
              <Td muted noPhone className="min-w-[140px]">
                {r.reason}
              </Td>
              <Td mono wide>
                {r.roomCode ?? ""}
              </Td>
              <Td muted nowrap wide>
                {ago(r.createdAt)}
              </Td>
              <Td>
                <StatusLabel status={r.status} />
              </Td>
              <ActionsTd>
                {r.status === "open" && (
                  <>
                    <RowAction
                      icon={XIcon}
                      label={t("dismiss")}
                      onClick={() => act(r, "dismiss")}
                    />
                    {r.questionId && r.questionStatus && r.questionStatus !== "hidden" && (
                      <RowAction
                        danger
                        icon={EyeSlashIcon}
                        label={t("hideQuestion")}
                        onClick={() => act(r, "hide_question")}
                      />
                    )}
                    {r.playerId && r.playerStatus && r.playerStatus !== "removed" && (
                      <RowAction
                        danger
                        icon={UserMinusIcon}
                        label={t("removePlayer")}
                        onClick={() =>
                          setConfirm({
                            title: t("removeTitle", {
                              name: r.playerNickname ?? t("unknownPlayer"),
                            }),
                            body: t("removeBody"),
                            cta: t("removeCta"),
                            run: async () => {
                              await act(r, "remove_player");
                            },
                          })
                        }
                      />
                    )}
                  </>
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
