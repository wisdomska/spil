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
  useAdminQuery,
  useAgo,
  usePaging,
  type ConfirmState,
} from "@/components/admin/ui";
import type { AdminReport } from "@/lib/admin/types";

type Chip = "open" | "actioned" | "dismissed" | "all";

export function ReportsSection() {
  const t = useTranslations("admin.reports");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const q = useAdminQuery<AdminReport[]>("/reports");
  const run = useAdminAction();
  const ago = useAgo();
  const paging = usePaging();
  const [chip, setChip] = useState<Chip>("open");
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const rows = (q.data ?? []).filter((r) => chip === "all" || r.status === chip);
  const shown = paging.slice(rows);

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
        onChange={(c) => {
          setChip(c);
          paging.reset();
        }}
        items={(["open", "actioned", "dismissed", "all"] as const).map((c) => ({
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
          caption={tn("reports")}
          cols={[
            { label: t("cols.subject") },
            { label: t("cols.reason"), width: 150, noPhone: true },
            { label: t("cols.room"), width: 80, wide: true },
            { label: t("cols.when"), width: 110, wide: true },
            { label: t("cols.status"), width: 110 },
          ]}
          empty={rows.length === 0}
          emptyText={chip === "open" ? t("emptyOpen") : t("empty")}
          total={rows.length}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
        >
          {shown.map((r) => (
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
