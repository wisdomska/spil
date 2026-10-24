"use client";

import {
  ArchiveIcon,
  ArrowBendUpLeftIcon,
  ArrowCounterClockwiseIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ActionsTd,
  adminApi,
  Chips,
  DataTable,
  LoadError,
  PageHeader,
  RowAction,
  TableSkeleton,
  Td,
  Tr,
  useAdminAction,
  useAdminQuery,
  usePaging,
  when,
} from "@/components/admin/ui";
import type { AdminMessage } from "@/lib/admin/types";

type Chip = "new" | "all" | "archived";

export function InboxSection() {
  const t = useTranslations("admin.inbox");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const q = useAdminQuery<AdminMessage[]>("/messages");
  const run = useAdminAction();
  const paging = usePaging();
  const [chip, setChip] = useState<Chip>("all");

  const rows = (q.data ?? []).filter((m) =>
    chip === "archived"
      ? m.status === "archived"
      : chip === "new"
        ? m.status === "new"
        : m.status !== "archived",
  );
  const shown = paging.slice(rows);

  const setStatus = (m: AdminMessage, status: AdminMessage["status"], ok: string) =>
    run(() => adminApi("PATCH", `/messages/${m.id}`, { status }), { ok });

  return (
    <>
      <PageHeader title={tn("inbox")} />
      <Chips<Chip>
        label={tn("inbox")}
        value={chip}
        onChange={(c) => {
          setChip(c);
          paging.reset();
        }}
        items={(["all", "new", "archived"] as const).map((c) => ({
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
          caption={tn("inbox")}
          cols={[
            { label: t("cols.when"), width: 130, wide: true },
            { label: t("cols.from"), width: 200, noPhone: true },
            { label: t("cols.message") },
          ]}
          empty={rows.length === 0}
          emptyText={t("empty")}
          total={rows.length}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
        >
          {shown.map((m) => {
            const fresh = m.status === "new";
            return (
              <Tr key={m.id}>
                <Td mono muted nowrap wide>
                  {when(m.createdAt)}
                </Td>
                <Td bold={fresh} muted={!m.email} noPhone className="break-all">
                  {m.name ? (
                    <span className="grid gap-0.5">
                      <span>{m.name}</span>
                      <span className="text-text-muted">{m.email ?? t("noEmail")}</span>
                    </span>
                  ) : (
                    (m.email ?? t("noEmail"))
                  )}
                </Td>
                <Td bold={fresh} className="min-w-[220px] whitespace-pre-line">
                  {m.body}
                </Td>
                <ActionsTd>
                  {m.email && (
                    <RowAction
                      icon={ArrowBendUpLeftIcon}
                      label={t("reply")}
                      onClick={() =>
                        window.open(
                          `mailto:${m.email}?subject=${encodeURIComponent(t("replySubject"))}`,
                        )
                      }
                    />
                  )}
                  {m.status === "archived" ? (
                    <RowAction
                      icon={ArrowCounterClockwiseIcon}
                      label={t("restore")}
                      onClick={() => setStatus(m, "read", t("restored"))}
                    />
                  ) : (
                    <>
                      {fresh ? (
                        <RowAction
                          icon={EnvelopeOpenIcon}
                          label={t("markRead")}
                          onClick={() => setStatus(m, "read", t("markedRead"))}
                        />
                      ) : (
                        <RowAction
                          icon={EnvelopeIcon}
                          label={t("markUnread")}
                          onClick={() => setStatus(m, "new", t("markedUnread"))}
                        />
                      )}
                      <RowAction
                        icon={ArchiveIcon}
                        label={t("archive")}
                        onClick={() => setStatus(m, "archived", t("archivedToast"))}
                      />
                    </>
                  )}
                </ActionsTd>
              </Tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
