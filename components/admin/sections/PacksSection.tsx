"use client";

import { ListBulletsIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FieldRow, Input, Select, TextArea } from "@/components/admin/fields";
import {
  ActionsTd,
  adminApi,
  ConfirmDialog,
  DataTable,
  FormDialog,
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
import { PACK_ICONS, PackGlyph } from "@/components/brand/PackGlyph";
import { Button } from "@/components/ui/Button";
import type { AdminPack } from "@/lib/admin/types";

type Rating = "all" | "spicy" | "explicit" | "intense";
type Form = {
  name: string;
  blurb: string;
  icon: string;
  tone: AdminPack["tone"];
  rating: Rating;
  region: string;
  status: AdminPack["status"];
  sortOrder: string;
};

const ICON_NAMES = Object.keys(PACK_ICONS);
const iconLabel = (key: string) => {
  const s = key.replace(/-/g, " ");
  return s[0]!.toUpperCase() + s.slice(1);
};

const blank: Form = {
  name: "",
  blurb: "",
  icon: "cards",
  tone: "accent",
  rating: "all",
  region: "",
  status: "draft",
  sortOrder: "100",
};

export function PacksSection() {
  const t = useTranslations("admin.packs");
  const tn = useTranslations("admin.nav");
  const ts = useTranslations("admin.status");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const q = useAdminQuery<AdminPack[]>("/packs");
  const run = useAdminAction();
  const ago = useAgo();
  const paging = usePaging();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const open = (p: AdminPack | null) => {
    setError(null);
    setEditing({ id: p?.id ?? null });
    setForm(
      p
        ? {
            name: p.name,
            blurb: p.blurb,
            icon: p.icon,
            tone: p.tone,
            rating: p.isAdult ? (p.heat ?? "spicy") : "all",
            region: p.region ?? "",
            status: p.status,
            sortOrder: String(p.sortOrder),
          }
        : blank,
    );
  };
  const set =
    <K extends keyof Form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setError(null);
    };

  const save = async () => {
    const name = form.name.trim();
    if (name.length < 2) return setError(t("needName"));
    if (!editing?.id && form.status === "live") return setError(t("draftFirst"));
    setBusy(true);
    const body = {
      name,
      blurb: form.blurb.trim(),
      icon: form.icon,
      tone: form.tone,
      isAdult: form.rating !== "all",
      heat: form.rating === "all" ? null : form.rating,
      region: form.region || null,
      status: form.status,
      sortOrder: Math.max(0, Math.min(10000, parseInt(form.sortOrder, 10) || 0)),
    };
    const res = await run(
      () =>
        editing?.id
          ? adminApi("PATCH", `/packs/${editing.id}`, body)
          : adminApi("POST", "/packs", body),
      {
        ok: editing?.id ? t("saved") : t("created"),
        quiet: true,
        errors: { DUPLICATE: t("nameTaken"), PACK_NOT_READY: t("notReady") },
      },
    );
    setBusy(false);
    if (res.code) return setError(res.message);
    setEditing(null);
  };

  const pack = editing?.id ? q.data?.find((p) => p.id === editing.id) : null;
  const del = () => {
    if (!pack) return;
    setConfirm({
      title: t("deleteTitle", { name: pack.name }),
      body: t("deleteBody", { count: pack.totalQuestions }),
      cta: t("deleteCta"),
      run: async () => {
        const res = await run(() => adminApi("DELETE", `/packs/${pack.id}`), {
          ok: t("deleted"),
          errors: { PACK_IN_USE: t("inUse") },
        });
        if (!res.code) setEditing(null);
      },
    });
  };

  const list = q.data ?? [];
  const shown = list.slice(0, paging.limit);

  return (
    <>
      <PageHeader title={tn("packs")}>
        <Button size="md" onClick={() => open(null)} className="px-[18px]">
          <PlusIcon aria-hidden size={18} />
          {t("new")}
        </Button>
      </PageHeader>
      {q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("packs")}
          cols={[
            { label: t("cols.pack") },
            { label: t("cols.questions"), width: 110, right: true, noPhone: true },
            { label: t("cols.rating"), width: 130, noPhone: true },
            { label: t("cols.status"), width: 110 },
            { label: t("cols.games"), width: 90, right: true, wide: true },
            { label: t("cols.updated"), width: 120, wide: true },
          ]}
          empty={list.length === 0}
          emptyText={t("empty")}
          total={list.length}
          shown={shown.length}
          onMore={paging.more}
        >
          {shown.map((p) => (
            <Tr key={p.id}>
              <Td bold nowrap>
                <span className="inline-flex items-center gap-2 align-middle">
                  <PackGlyph icon={p.icon} size={18} />
                  {p.name}
                </span>
              </Td>
              <Td mono right noPhone>
                {p.liveQuestions} / {p.totalQuestions}
              </Td>
              <Td mono nowrap noPhone>
                {t(`rating.${p.isAdult ? (p.heat ?? "spicy") : "all"}`)}
              </Td>
              <Td>
                <StatusLabel status={p.status} />
              </Td>
              <Td mono right wide>
                {p.games}
              </Td>
              <Td muted nowrap wide>
                {ago(p.updatedAt)}
              </Td>
              <ActionsTd>
                <RowAction
                  icon={ListBulletsIcon}
                  label={t("questionsAction")}
                  onClick={() => router.push(`/admin/questions?pack=${encodeURIComponent(p.id)}`)}
                />
                <RowAction icon={PencilSimpleIcon} label={t("edit")} onClick={() => open(p)} />
              </ActionsTd>
            </Tr>
          ))}
        </DataTable>
      )}

      <FormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? t("editTitle") : t("newTitle")}
        onSubmit={save}
        error={error}
        busy={busy}
        onDelete={editing?.id ? del : undefined}
      >
        <FieldRow id="pk-name" label={t("name")}>
          <Input id="pk-name" value={form.name} onChange={set("name")} maxLength={40} required />
        </FieldRow>
        <FieldRow id="pk-blurb" label={t("blurb")} hint={t("blurbHint")}>
          <TextArea
            id="pk-blurb"
            rows={2}
            value={form.blurb}
            onChange={set("blurb")}
            maxLength={140}
            aria-describedby="pk-blurb-hint"
            className="!resize-none"
          />
        </FieldRow>
        <FieldRow id="pk-icon" label={t("icon")}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-surface"
            >
              <PackGlyph icon={form.icon} size={22} />
            </span>
            <Select id="pk-icon" value={form.icon} onChange={set("icon")} className="flex-1">
              {ICON_NAMES.map((k) => (
                <option key={k} value={k}>
                  {iconLabel(k)}
                </option>
              ))}
            </Select>
          </div>
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id="pk-tone" label={t("tone")}>
            <Select id="pk-tone" value={form.tone} onChange={set("tone")}>
              {(["accent", "raised", "inverse"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`tones.${v}`)}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow id="pk-region" label={t("region")}>
            <Select id="pk-region" value={form.region} onChange={set("region")}>
              <option value="">{t("regions.all")}</option>
              <option value="GH">{t("regions.GH")}</option>
              <option value="NG">{t("regions.NG")}</option>
            </Select>
          </FieldRow>
        </div>
        <FieldRow id="pk-rating" label={t("ratingLabel")}>
          <Select id="pk-rating" value={form.rating} onChange={set("rating")}>
            {(["all", "spicy", "explicit", "intense"] as const).map((v) => (
              <option key={v} value={v}>
                {t(`ratings.${v}`)}
              </option>
            ))}
          </Select>
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <FieldRow id="pk-status" label={t("status")} hint={t("statusHint")}>
            <Select
              id="pk-status"
              value={form.status}
              onChange={set("status")}
              aria-describedby="pk-status-hint"
            >
              {(["live", "draft", "hidden"] as const).map((v) => (
                <option key={v} value={v}>
                  {ts(v)}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow id="pk-order" label={t("order")}>
            <Input
              id="pk-order"
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              value={form.sortOrder}
              onChange={set("sortOrder")}
              title={t("orderHint")}
            />
          </FieldRow>
        </div>
      </FormDialog>
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </>
  );
}
