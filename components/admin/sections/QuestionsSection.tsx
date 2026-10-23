"use client";

import {
  DownloadSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSimpleIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMe } from "@/components/admin/ConsoleShell";
import { ErrorLine, FieldRow, Select, TextArea } from "@/components/admin/fields";
import {
  ActionsTd,
  adminApi,
  Chips,
  ConfirmDialog,
  DataTable,
  downloadText,
  FormDialog,
  LoadError,
  OutlineButton,
  PageHeader,
  RowAction,
  SearchBox,
  StatusLabel,
  TableSkeleton,
  Td,
  Tr,
  useAdminAction,
  useAdminQuery,
  usePaging,
  type ConfirmState,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { yesRate, type QStatus } from "@/lib/admin/questions";
import { can } from "@/lib/admin/roles";
import type { AdminPack, AdminQuestion, ImportSummary } from "@/lib/admin/types";

type Form = { text: string; packId: string; status: QStatus };
const STATUSES = ["live", "draft", "hidden"] as const;

export function QuestionsSection() {
  const t = useTranslations("admin.questions");
  const tn = useTranslations("admin.nav");
  const ts = useTranslations("admin.status");
  const tc = useTranslations("admin.common");
  const me = useMe();
  const toast = useToast();
  const params = useSearchParams();
  const canWrite = can(me.role, "questions.write");
  const q = useAdminQuery<AdminQuestion[]>("/questions");
  const packs = useAdminQuery<AdminPack[]>("/packs");
  const run = useAdminAction();
  const paging = usePaging();
  const [pack, setPack] = useState(params.get("pack") ?? "all");
  const [status, setStatus] = useState<"all" | QStatus>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<Form>({ text: "", packId: "", status: "live" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [importing, setImporting] = useState(false);

  const packList = packs.data ?? [];
  const packName = (id: string) => packList.find((p) => p.id === id)?.name ?? id;
  const sq = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (x) =>
      (pack === "all" || x.packId === pack) &&
      (status === "all" || x.status === status) &&
      (!sq || x.text.toLowerCase().includes(sq)),
  );
  const shown = rows.slice(0, paging.limit);

  const textErrors = {
    DUPLICATE: editing?.id ? t("duplicate") : t("allDuplicates"),
    QUESTION_INVALID: t("tooShort"),
  };

  const open = (x: AdminQuestion | null) => {
    setError(null);
    setEditing({ id: x?.id ?? null });
    setForm(
      x
        ? { text: x.text, packId: x.packId, status: x.status }
        : { text: "", packId: pack !== "all" ? pack : (packList[0]?.id ?? ""), status: "live" },
    );
  };

  const save = async () => {
    const lines = form.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return setError(t("tooShort"));
    if (!form.packId) return setError(t("pickPack"));
    setBusy(true);
    let res;
    if (editing?.id) {
      res = await run(
        () =>
          adminApi("PATCH", `/questions/${editing.id}`, {
            text: lines.join(" "),
            packId: form.packId,
            status: form.status,
          }),
        { ok: t("saved"), quiet: true, errors: textErrors },
      );
    } else {
      res = await run(
        () =>
          adminApi<{ added: number; duplicates: number }>("POST", "/questions", {
            packId: form.packId,
            status: form.status,
            texts: lines,
          }),
        { quiet: true, errors: textErrors },
      );
      if (res.data) {
        const { added, duplicates } = res.data as { added: number; duplicates: number };
        toast(
          added === 1 && !duplicates
            ? t("added")
            : t("addedMany", { count: added, skipped: duplicates ? "yes" : "no" }),
        );
      }
    }
    setBusy(false);
    if (res.code) {
      // The API names which text rule failed; show the matching message.
      if (res.code === "QUESTION_INVALID" && res.raw === "too_long") return setError(t("tooLong"));
      return setError(res.message);
    }
    setEditing(null);
  };

  const toggle = (x: AdminQuestion) =>
    run(
      () =>
        adminApi("PATCH", `/questions/${x.id}`, {
          status: x.status === "hidden" ? "live" : "hidden",
        }),
      { ok: x.status === "hidden" ? t("shown") : t("hidden") },
    );

  const current = editing?.id ? q.data?.find((x) => x.id === editing.id) : null;
  const del = () => {
    if (!current) return;
    setConfirm({
      title: t("deleteTitle"),
      body: t("deleteBody", { text: current.text }),
      cta: t("deleteCta"),
      run: async () => {
        const res = await run(() => adminApi("DELETE", `/questions/${current.id}`), {
          ok: t("deleted"),
          errors: { QUESTION_IN_USE: t("inUse") },
        });
        if (!res.code) setEditing(null);
      },
    });
  };

  const exportCsv = async () => {
    const qs = new URLSearchParams();
    if (pack !== "all") qs.set("pack", pack);
    if (status !== "all") qs.set("status", status);
    if (sq) qs.set("q", sq);
    try {
      const res = await fetch(`/api/v1/admin/questions/export?${qs}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(String(res.status));
      downloadText("spil-questions.csv", await res.text());
      toast(t("exported", { count: rows.length }));
    } catch {
      toast(tc("somethingWrong"), "err");
    }
  };

  return (
    <>
      <PageHeader title={tn("questions")}>
        {canWrite && (
          <Button size="md" onClick={() => open(null)} className="px-[18px]">
            <PlusIcon aria-hidden size={18} />
            {t("add")}
          </Button>
        )}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            paging.reset();
          }}
          placeholder={t("searchPh")}
        />
        <Select
          aria-label={t("statusFilter")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "all" | QStatus);
            paging.reset();
          }}
          className="w-full sm:w-[150px]"
        >
          <option value="all">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
        <OutlineButton onClick={exportCsv}>
          <DownloadSimpleIcon aria-hidden size={18} />
          {tc("exportCsv")}
        </OutlineButton>
        {canWrite && (
          <>
            <OutlineButton onClick={() => setImporting(true)}>
              <UploadSimpleIcon aria-hidden size={18} />
              {t("import")}
            </OutlineButton>
          </>
        )}
      </div>
      <Chips
        label={t("packFilter")}
        value={pack}
        onChange={(v) => {
          setPack(v);
          paging.reset();
        }}
        items={[
          { value: "all", label: tc("all") },
          ...packList.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
      {q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("questions")}
          cols={[
            { label: t("cols.text") },
            { label: t("cols.pack"), width: 130, noPhone: true },
            { label: t("cols.yesRate"), width: 90, right: true, wide: true },
            { label: t("cols.answered"), width: 100, right: true, wide: true },
            { label: t("cols.reports"), width: 80, right: true, wide: true },
            { label: t("cols.status"), width: 100 },
          ]}
          empty={rows.length === 0}
          emptyText={t("empty")}
          total={rows.length}
          shown={shown.length}
          onMore={paging.more}
        >
          {shown.map((x) => {
            const rate = yesRate(x.yes, x.answered);
            return (
              <Tr key={x.id}>
                <Td className="min-w-[200px] min-[1100px]:min-w-[260px]">{x.text}</Td>
                <Td muted nowrap noPhone>
                  {packName(x.packId)}
                </Td>
                <Td mono right wide>
                  {rate === null ? tc("na") : `${rate}%`}
                </Td>
                <Td mono right wide>
                  {x.answered}
                </Td>
                <Td mono right wide>
                  {x.reports}
                </Td>
                <Td>
                  <StatusLabel status={x.status} />
                </Td>
                <ActionsTd>
                  {(canWrite || x.status !== "hidden") && (
                    <RowAction
                      icon={x.status === "hidden" ? EyeIcon : EyeSlashIcon}
                      label={x.status === "hidden" ? t("show") : t("hide")}
                      onClick={() => toggle(x)}
                    />
                  )}
                  {canWrite && (
                    <RowAction icon={PencilSimpleIcon} label={t("edit")} onClick={() => open(x)} />
                  )}
                </ActionsTd>
              </Tr>
            );
          })}
        </DataTable>
      )}

      <FormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? t("editTitle") : t("addTitle")}
        onSubmit={save}
        error={error}
        busy={busy}
        onDelete={editing?.id ? del : undefined}
      >
        <FieldRow
          id="qn-text"
          label={t("text")}
          hint={editing?.id ? t("textHintEdit") : t("textHintAdd")}
        >
          <TextArea
            id="qn-text"
            value={form.text}
            rows={editing?.id ? 3 : 5}
            maxLength={editing?.id ? 140 : 20000}
            aria-describedby="qn-text-hint"
            onChange={(e) => {
              setForm((f) => ({ ...f, text: e.target.value }));
              setError(null);
            }}
          />
        </FieldRow>
        <FieldRow id="qn-pack" label={t("pack")}>
          <Select
            id="qn-pack"
            value={form.packId}
            onChange={(e) => setForm((f) => ({ ...f, packId: e.target.value }))}
          >
            {packList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow id="qn-status" label={t("status")}>
          <Select
            id="qn-status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as QStatus }))}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </Select>
        </FieldRow>
      </FormDialog>

      <ImportDialog open={importing} onClose={() => setImporting(false)} />
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin.questions");
  const ts = useTranslations("admin.status");
  const toast = useToast();
  const run = useAdminAction();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<QStatus>("live");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportSummary["errors"]>([]);

  const close = () => {
    setFile(null);
    setError(null);
    setRowErrors([]);
    onClose();
  };

  const submit = async () => {
    if (!file) return setError(t("importNoFile"));
    setBusy(true);
    setRowErrors([]);
    const csv = await file.text();
    const res = await run(
      () => adminApi<ImportSummary>("POST", "/questions/import", { csv, defaultStatus: status }),
      { quiet: true },
    );
    setBusy(false);
    if (res.code) return setError(res.message);
    const summary = res.data as ImportSummary;
    if (summary.errors.length) {
      setError(t("importErrors"));
      return setRowErrors(summary.errors);
    }
    toast(t("importDone", { added: summary.added, duplicates: summary.duplicates }));
    close();
  };

  const errorText = (code: string) =>
    t.has(`importError.${code}`) ? t(`importError.${code}`) : code;

  return (
    <FormDialog
      open={open}
      onClose={close}
      title={t("importTitle")}
      onSubmit={submit}
      busy={busy}
      submitLabel={t("importCta")}
    >
      <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("importIntro")}</p>
      <FieldRow id="qn-file" label={t("importFile")}>
        <label
          htmlFor="qn-file"
          className="flex min-h-14 cursor-pointer items-center gap-3 rounded-input border-[1.5px] border-dashed border-line-strong bg-bg px-4 py-3 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)] hover:border-text-muted"
        >
          <UploadSimpleIcon aria-hidden size={20} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
            {file ? file.name : t("importChoose")}
          </span>
          <span className="shrink-0 text-[14px] font-semibold text-accent-ink">
            {file ? t("importChange") : t("importBrowse")}
          </span>
          <input
            id="qn-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
              setRowErrors([]);
            }}
            className="sr-only"
          />
        </label>
      </FieldRow>
      <FieldRow id="qn-default" label={t("importDefault")}>
        <Select
          id="qn-default"
          value={status}
          onChange={(e) => setStatus(e.target.value as QStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
      </FieldRow>
      <ErrorLine>{error}</ErrorLine>
      {rowErrors.length > 0 && (
        <ul className="m-0 grid max-h-48 gap-1 overflow-auto rounded-input border border-line p-3 pl-7 font-mono text-[13px] leading-[1.4] text-text-muted">
          {rowErrors.slice(0, 50).map((e) => (
            <li key={`${e.line}-${e.error}`}>
              {t("importLine", { line: e.line, error: errorText(e.error) })}
            </li>
          ))}
        </ul>
      )}
    </FormDialog>
  );
}
