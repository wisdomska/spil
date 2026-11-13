"use client";

import { ListBulletsIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FieldRow, Input, TextArea, NumberInput } from "@/components/admin/fields";
import { Select } from "@/components/ui/Select";
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

const MIN_AGES = [13, 16, 18] as const;
type Form = {
  name: string;
  blurb: string;
  icon: string;
  tone: AdminPack["tone"];
  minAge: AdminPack["minAge"];
  section: AdminPack["section"];
  spice: string;
  premium: "free" | "premium";
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
  minAge: 13,
  section: "everyday",
  spice: "2",
  premium: "free",
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
            minAge: p.minAge,
            section: p.section,
            spice: String(p.spice),
            premium: p.premium ? "premium" : "free",
            region: p.region ?? "",
            status: p.status,
            sortOrder: String(p.sortOrder),
          }
        : blank,
    );
  };
  const pick =
    <K extends keyof Form>(k: K) =>
    (value: string) => {
      setForm((f) => ({ ...f, [k]: value }));
      setError(null);
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
      minAge: form.minAge,
      section: form.section,
      spice: Math.max(1, Math.min(5, parseInt(form.spice, 10) || 1)),
      premium: form.premium === "premium",
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
  const shown = paging.slice(list);

  return (
    <>
      <PageHeader title={tn("packs")}>
        <Button size="md" onClick={() => open(null)} className="px-[18px]">
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
            { label: t("cols.minAge"), width: 110, noPhone: true },
            { label: t("cols.status"), width: 110 },
            { label: t("cols.games"), width: 90, right: true, wide: true },
            { label: t("cols.updated"), width: 120, wide: true },
          ]}
          empty={list.length === 0}
          emptyText={t("empty")}
          total={list.length}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
          onSize={paging.setSize}
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
                {t(`minAgeShort.${p.minAge}`)}
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
            <Select
              id="pk-icon"
              value={form.icon}
              onValueChange={pick("icon")}
              className="flex-1"
              options={ICON_NAMES.map((k) => ({ value: k, label: iconLabel(k) }))}
            />
          </div>
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id="pk-tone" label={t("tone")}>
            <Select
              id="pk-tone"
              value={form.tone}
              onValueChange={pick("tone")}
              options={(["accent", "raised", "inverse"] as const).map((v) => ({
                value: v,
                label: t(`tones.${v}`),
              }))}
            />
          </FieldRow>
          <FieldRow id="pk-region" label={t("region")}>
            <Select
              id="pk-region"
              value={form.region}
              onValueChange={pick("region")}
              options={[
                { value: "", label: t("regions.all") },
                { value: "GH", label: t("regions.GH") },
                { value: "NG", label: t("regions.NG") },
              ]}
            />
          </FieldRow>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id="pk-section" label={t("section")}>
            <Select
              id="pk-section"
              value={form.section}
              onValueChange={pick("section")}
              options={(["everyday", "life", "after_dark"] as const).map((v) => ({
                value: v,
                label: t(`sections.${v}`),
              }))}
            />
          </FieldRow>
          <FieldRow id="pk-spice" label={t("spice")} hint={t("spiceHint")}>
            <Select
              id="pk-spice"
              value={form.spice}
              onValueChange={pick("spice")}
              options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }))}
            />
          </FieldRow>
        </div>
        <FieldRow id="pk-premium" label={t("premium")} hint={t("premiumHint")}>
          <Select
            id="pk-premium"
            value={form.premium}
            onValueChange={pick("premium")}
            options={[
              { value: "free", label: t("premiumFree") },
              { value: "premium", label: t("premiumOn") },
            ]}
          />
        </FieldRow>
        <FieldRow id="pk-min-age" label={t("minAgeLabel")} hint={t("minAgeHint")}>
          <Select
            id="pk-min-age"
            value={String(form.minAge)}
            onValueChange={(v) => {
              setForm((f) => ({ ...f, minAge: Number(v) as AdminPack["minAge"] }));
              setError(null);
            }}
            options={MIN_AGES.map((v) => ({ value: String(v), label: t(`minAges.${v}`) }))}
          />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <FieldRow id="pk-status" label={t("status")} hint={t("statusHint")}>
            <Select
              id="pk-status"
              value={form.status}
              onValueChange={pick("status")}
              aria-describedby="pk-status-hint"
              options={(["live", "draft", "hidden"] as const).map((v) => ({
                value: v,
                label: ts(v),
              }))}
            />
          </FieldRow>
          <FieldRow id="pk-order" label={t("order")}>
            <NumberInput
              id="pk-order"
              min={0}
              max={10000}
              value={form.sortOrder}
              onValueChange={(v) => {
                setForm((f) => ({ ...f, sortOrder: v }));
                setError(null);
              }}
              title={t("orderHint")}
              decreaseLabel={tc("decrease", { field: t("order") })}
              increaseLabel={tc("increase", { field: t("order") })}
            />
          </FieldRow>
        </div>
      </FormDialog>
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </>
  );
}
