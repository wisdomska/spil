"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { initials, useMe } from "@/components/admin/ConsoleShell";
import { ErrorLine, FieldRow, Input, Select, NumberInput } from "@/components/admin/fields";
import {
  adminApi,
  ConfirmDialog,
  FormDialog,
  LoadError,
  OutlineButton,
  PageHeader,
  Panel,
  useAdminAction,
  useAdminQuery,
  type ConfirmState,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { SwitchRow } from "@/components/ui/Switch";
import { can, ROLES, type AdminRole } from "@/lib/admin/roles";
import { FLAG_KEYS, PASSWORD_MIN } from "@/lib/admin/schemas";
import type { AdminAccount, Me, SettingsPayload } from "@/lib/admin/types";

const EMAIL = /^\S+@\S+\.\S+$/;

export function SettingsSection() {
  const tn = useTranslations("admin.nav");
  const me = useMe();
  const owner = can(me.role, "settings.write");
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-[22px]">
      <PageHeader title={tn("settings")} />
      {owner && <GameSettings />}
      <Accounts me={me} />
    </div>
  );
}

function GameSettings() {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("admin.common");
  const q = useAdminQuery<SettingsPayload>("/settings");
  const run = useAdminAction();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  if (q.isError) return <LoadError onRetry={() => q.refetch()} />;
  if (!q.data)
    return (
      <SkeletonGroup label={tc("loading")} className="gap-5">
        <Skeleton className="h-[340px] rounded-card" />
        <Skeleton className="h-[300px] rounded-card" />
      </SkeletonGroup>
    );

  const s = q.data.settings;
  const vals = draft ?? {
    questionsPerGame: String(s.questionsPerGame),
    minPlayers: String(s.minPlayers),
    maxPlayers: String(s.maxPlayers),
    ageLockHours: String(s.ageLockHours),
  };
  const field = (key: string, label: string, hint: string, min: number, max: number) => (
    <FieldRow key={key} id={`set-${key}`} label={label} hint={hint}>
      <NumberInput
        id={`set-${key}`}
        min={min}
        max={max}
        value={vals[key] ?? ""}
        aria-describedby={`set-${key}-hint`}
        decreaseLabel={tc("decrease", { field: label })}
        increaseLabel={tc("increase", { field: label })}
        onValueChange={(v) => {
          setDraft({ ...vals, [key]: v });
          setError(null);
        }}
      />
    </FieldRow>
  );

  const save = async () => {
    const qn = Number(vals.questionsPerGame);
    const mn = Number(vals.minPlayers);
    const mx = Number(vals.maxPlayers);
    const lock = Number(vals.ageLockHours);
    if (!Number.isInteger(qn) || qn < 5 || qn > 100) return setError(t("rangeQuestions"));
    if (!Number.isInteger(mn) || mn < 1 || mn > 20) return setError(t("rangeMin"));
    if (!Number.isInteger(mx) || mx < mn || mx > 20) return setError(t("rangeMax"));
    if (!Number.isInteger(lock) || lock < 1 || lock > 168) return setError(t("rangeAgeLock"));
    setBusy(true);
    const res = await run(
      () =>
        adminApi("PATCH", "/settings", {
          questionsPerGame: qn,
          minPlayers: mn,
          maxPlayers: mx,
          ageLockHours: lock,
        }),
      { ok: t("saved") },
    );
    setBusy(false);
    if (!res.code) setDraft(null);
  };

  return (
    <>
      <Panel className="grid gap-[18px] p-6">
        <h2 className="m-0 text-[17px] leading-none font-bold">{t("game")}</h2>
        <form
          noValidate
          className="grid gap-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) save();
          }}
        >
          <div className="grid gap-[18px] sm:grid-cols-3 sm:gap-4">
            {field("questionsPerGame", t("questionsPerGame"), t("questionsPerGameHint"), 5, 100)}
            {field("minPlayers", t("minPlayers"), t("minPlayersHint"), 1, 20)}
            {field("maxPlayers", t("maxPlayers"), t("maxPlayersHint"), 3, 20)}
          </div>
          <div className="grid gap-[18px] sm:grid-cols-3 sm:gap-4">
            {field("ageLockHours", t("ageLockHours"), t("ageLockHoursHint"), 1, 168)}
          </div>
          <ErrorLine>{error}</ErrorLine>
          <div>
            <Button type="submit" size="md" loading={busy} className="px-[22px]">
              {t("save")}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="grid gap-3 p-6">
        <h2 className="m-0 mb-1 text-[17px] leading-none font-bold">{t("flags")}</h2>
        {FLAG_KEYS.map((key) => {
          const on = q.data.flags[key] ?? false;
          return (
            <SwitchRow
              key={key}
              look="plain"
              className="-mx-2 w-[calc(100%+16px)]"
              checked={on}
              title={t(`flag.${key}.title`)}
              description={t(`flag.${key}.body`)}
              onCheckedChange={(enabled) =>
                run(() => adminApi("PATCH", "/flags", { key, enabled }), {
                  ok: t("flagSaved", {
                    name: t(`flag.${key}.title`),
                    on: enabled ? "yes" : "no",
                  }),
                })
              }
            />
          );
        })}
      </Panel>

      {q.data.canResetData && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-error px-6 py-5">
          <div className="grid min-w-0 flex-[1_1_240px] gap-1.5">
            <span className="text-[17px] leading-none font-bold">{t("dangerTitle")}</span>
            <span className="text-[14px] leading-[1.45] text-text-muted">{t("dangerBody")}</span>
          </div>
          <OutlineButton
            danger
            className="px-5"
            onClick={() =>
              setConfirm({
                title: t("dangerConfirmTitle"),
                body: t("dangerConfirmBody"),
                cta: t("dangerCta"),
                run: async () => {
                  await run(() => adminApi("POST", "/reset-data"), { ok: t("dataReset") });
                },
              })
            }
          >
            {t("dangerCta")}
          </OutlineButton>
        </div>
      )}
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </>
  );
}

type Modal = "add" | "details" | "password" | null;

function Accounts({ me }: { me: Me }) {
  const t = useTranslations("admin.settings");
  const tr = useTranslations("admin.roles");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const owner = can(me.role, "admins.manage");
  const list = useAdminQuery<AdminAccount[]>("/admins", owner);
  const run = useAdminAction();
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const admins = owner && Array.isArray(list.data) ? list.data : [];
  const ownerCount = admins.filter((a) => a.role === "owner").length;

  const openModal = (m: Modal) => {
    setError(null);
    setModal(m);
    setForm(
      m === "add"
        ? { role: "moderator" }
        : m === "details"
          ? { name: me.name, email: me.email }
          : {},
    );
  };
  const input = (key: string, label: string, type = "text", hint?: string, max = 120) => (
    <FieldRow id={`ac-${key}`} label={label} hint={hint}>
      <Input
        id={`ac-${key}`}
        type={type}
        maxLength={max}
        autoComplete={
          type === "password"
            ? key === "current"
              ? "current-password"
              : "new-password"
            : type === "email"
              ? "email"
              : "name"
        }
        value={form[key] ?? ""}
        aria-describedby={hint ? `ac-${key}-hint` : undefined}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }));
          setError(null);
        }}
      />
    </FieldRow>
  );

  const save = async () => {
    const name = (form.name ?? "").trim();
    const email = (form.email ?? "").trim().toLowerCase();
    let res;
    if (modal === "add") {
      if (name.length < 2) return setError(t("needName"));
      if (!EMAIL.test(email)) return setError(t("emailOff"));
      if ((form.password ?? "").length < PASSWORD_MIN) return setError(t("tooShort"));
      setBusy(true);
      res = await run(
        () =>
          adminApi("POST", "/admins", { name, email, password: form.password, role: form.role }),
        { ok: t("added"), quiet: true, errors: { EMAIL_TAKEN: t("emailTaken") } },
      );
    } else if (modal === "details") {
      if (name.length < 2) return setError(t("needYourName"));
      if (!EMAIL.test(email)) return setError(t("emailOff"));
      if (!form.current) return setError(t("currentHint"));
      setBusy(true);
      res = await run(
        () => adminApi("PATCH", "/me", { name, email, currentPassword: form.current }),
        {
          ok: t("detailsSaved"),
          quiet: true,
          errors: { WRONG_PASSWORD: t("currentWrong"), EMAIL_TAKEN: t("otherEmail") },
        },
      );
      if (!res.code) router.refresh();
    } else {
      if (!form.current) return setError(t("currentWrong"));
      if ((form.password ?? "").length < PASSWORD_MIN) return setError(t("newTooShort"));
      if (form.password !== form.confirm) return setError(t("mismatch"));
      setBusy(true);
      res = await run(
        () =>
          adminApi("POST", "/me/password", {
            currentPassword: form.current,
            password: form.password,
          }),
        { ok: t("passwordChanged"), quiet: true, errors: { WRONG_PASSWORD: t("currentWrong") } },
      );
    }
    setBusy(false);
    if (res.code) return setError(res.message);
    setModal(null);
  };

  const changeRole = (a: AdminAccount, role: AdminRole) =>
    run(() => adminApi("PATCH", `/admins/${a.userId}`, { role }), {
      ok: t("roleChanged", { name: a.name, role: tr(role) }),
      errors: { LAST_OWNER: t("lastOwner") },
    });

  return (
    <Panel className="grid gap-3.5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[17px] leading-none font-bold">
          {owner ? t("accounts") : t("myAccount")}
        </h2>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <OutlineButton onClick={() => openModal("details")}>{t("editDetails")}</OutlineButton>
          <OutlineButton onClick={() => openModal("password")}>{t("changePassword")}</OutlineButton>
          {owner && (
            <Button size="md" className="px-[18px] max-sm:w-full" onClick={() => openModal("add")}>
              {t("addAdmin")}
            </Button>
          )}
        </div>
      </div>
      {!owner && <AdminRow a={me} you />}
      {owner && list.isError && <LoadError onRetry={() => list.refetch()} />}
      {owner &&
        admins.map((a) => {
          const you = a.userId === me.userId;
          return (
            <AdminRow key={a.userId} a={a} you={you}>
              {!you && (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Select
                    aria-label={t("roleFor", { name: a.name })}
                    value={a.role}
                    onChange={(e) => changeRole(a, e.target.value as AdminRole)}
                    className="min-w-[150px] flex-1 sm:flex-none"
                    disabled={a.role === "owner" && ownerCount <= 1}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {tr(r)}
                      </option>
                    ))}
                  </Select>
                  <OutlineButton
                    onClick={() =>
                      setConfirm({
                        title: t("resetTitle", { name: a.name }),
                        body: t("resetBody"),
                        cta: t("resetCta"),
                        run: async () => {
                          const res = await run(() =>
                            adminApi<{ password: string }>(
                              "POST",
                              `/admins/${a.userId}/reset-password`,
                            ),
                          );
                          if (!res.data) return;
                          return {
                            title: t("tempTitle"),
                            body: (
                              <span className="grid gap-3">
                                <span>{t("tempBody", { name: a.name })}</span>
                                <code className="rounded-input border border-line bg-bg px-3.5 py-3 font-mono text-[17px] font-semibold tracking-[0.04em] text-text select-all">
                                  {res.data.password}
                                </code>
                              </span>
                            ),
                            cta: tc("done"),
                          };
                        },
                      })
                    }
                  >
                    {t("resetPassword")}
                  </OutlineButton>
                  <OutlineButton
                    danger
                    disabled={a.role === "owner" && ownerCount <= 1}
                    onClick={() =>
                      setConfirm({
                        title: t("removeTitle", { name: a.name }),
                        body: t("removeBody"),
                        cta: t("removeCta"),
                        run: async () => {
                          await run(() => adminApi("DELETE", `/admins/${a.userId}`), {
                            ok: t("removed"),
                            errors: { LAST_OWNER: t("lastOwner") },
                          });
                        },
                      })
                    }
                  >
                    {t("remove")}
                  </OutlineButton>
                </div>
              )}
            </AdminRow>
          );
        })}

      <FormDialog
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal === "add"
            ? t("addTitle")
            : modal === "details"
              ? t("detailsTitle")
              : t("passwordTitle")
        }
        onSubmit={save}
        error={error}
        busy={busy}
      >
        {modal === "add" && (
          <>
            {input("name", t("name"), "text", undefined, 40)}
            {input("email", t("email"), "email")}
            {input("password", t("tempPassword"), "password", t("tempPasswordHint"), 72)}
            <FieldRow id="ac-role" label={t("role")}>
              <Select
                id="ac-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </Select>
            </FieldRow>
          </>
        )}
        {modal === "details" && (
          <>
            {input("name", t("name"), "text", undefined, 40)}
            {input("email", t("email"), "email", t("emailHint"))}
            {input("current", t("currentPassword"), "password", t("currentHint"), 200)}
          </>
        )}
        {modal === "password" && (
          <>
            {input("current", t("currentPassword"), "password", undefined, 200)}
            {input("password", t("newPassword"), "password", t("newPasswordHint"), 72)}
            {input("confirm", t("repeatPassword"), "password", undefined, 72)}
          </>
        )}
      </FormDialog>
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </Panel>
  );
}

function AdminRow({
  a,
  you,
  children,
}: {
  a: Pick<AdminAccount, "name" | "email" | "role">;
  you?: boolean;
  children?: React.ReactNode;
}) {
  const tr = useTranslations("admin.roles");
  const tc = useTranslations("admin.common");
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line py-2.5">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-pill bg-surface-raised text-[13px] leading-none font-bold"
      >
        {initials(a.name)}
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-[15px] leading-[1.2] font-semibold">{a.name}</span>
        <span className="text-[13px] leading-[1.2] break-all text-text-muted">
          {a.email} · {tr(a.role)}
        </span>
      </span>
      {you && (
        <span className="font-mono text-[12px] leading-none font-medium text-text-muted">
          {tc("you")}
        </span>
      )}
      {children}
    </div>
  );
}
