"use client";

import {
  CaretRightIcon,
  CrownSimpleIcon,
  ProhibitIcon,
  SignOutIcon,
  UserMinusIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useMe } from "@/components/admin/ConsoleShell";
import { FieldRow, Input, TextArea } from "@/components/admin/fields";
import {
  adminApi,
  Chips,
  ConfirmDialog,
  DataTable,
  downloadText,
  FormDialog,
  LoadError,
  OutlineButton,
  PageHeader,
  SearchBox,
  StatusLabel,
  TableSkeleton,
  Td,
  Tr,
  useAdminAction,
  useAdminPage,
  useAdminQuery,
  useAgo,
  usePaging,
  useUrlChip,
  useUrlSearch,
  useUrlState,
  when,
  type ConfirmState,
} from "@/components/admin/ui";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/admin/roles";
import type { AdminUser, AdminUserDetail, AdminUserSummary } from "@/lib/admin/types";
import { nextSort, parseUserSort, sortDirection } from "@/lib/admin/users";
import { cn } from "@/lib/cn";

type Chip = "all" | "accounts" | "guests" | "new" | "active" | "banned";
const CHIPS = ["all", "accounts", "guests", "new", "active", "banned"] as const;
type SortCol = "name" | "games" | "points" | "joined" | "seen";
type BanLength = "1" | "7" | "30" | "forever";

/**
 * Users (owner requests 2026-11-05, 2026-11-09 and 2026-11-12): accounts and guests who played,
 * sortable and filterable, with a detail panel for each person and actions on one or many:
 * ban, lift a ban, remove from live rooms, sign out everywhere, rename and (owners) delete.
 * Never an email address or what someone answered.
 */
export function UsersSection() {
  const t = useTranslations("admin.users");
  const tn = useTranslations("admin.nav");
  const tc = useTranslations("admin.common");
  const me = useMe();
  const canAct = can(me.role, "users.act");
  const ago = useAgo();
  const paging = usePaging();
  const search = useUrlSearch();
  const { params, set } = useUrlState();
  const [chip, setChip] = useUrlChip<Chip>("filter", "all", CHIPS);
  const sort = parseUserSort(params.get("sort"));
  const openId = params.get("user");
  const q = useAdminPage<AdminUser>("/users", {
    page: paging.page,
    size: paging.size,
    filter: chip,
    sort: sort === "joined_desc" ? undefined : sort,
    q: search.debounced.trim() || undefined,
  });
  const data = q.data as (typeof q.data & { summary?: AdminUserSummary }) | undefined;
  const s = data?.summary;

  // Selection is for the page on screen; changing page, filter, search or sort clears it.
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const viewKey = `${paging.page}|${paging.size}|${chip}|${sort}|${search.debounced}`;
  const [pickedFor, setPickedFor] = useState(viewKey);
  if (pickedFor !== viewKey) {
    setPickedFor(viewKey);
    setPicked(new Map());
  }
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const pickable = rows;
  const allOn = pickable.length > 0 && pickable.every((u) => picked.has(u.userId));
  const someOn = !allOn && pickable.some((u) => picked.has(u.userId));

  const sortCol = (col: SortCol) => ({
    sort: sortDirection(sort, col) ?? ("none" as const),
    onSort: () => {
      const next = nextSort(sort, col);
      set({ sort: next === "joined_desc" ? null : next, page: null });
    },
  });

  const tiles = s
    ? [
        { label: t("tiles.playingNow"), value: s.playingNow, note: t("tiles.playingNowNote") },
        { label: t("tiles.accounts"), value: s.accounts, note: t("tiles.accountsNote") },
        { label: t("tiles.active"), value: s.activeAccounts, note: t("tiles.activeNote") },
        {
          label: t("tiles.guests"),
          value: s.guests,
          note: t("tiles.guestsNote", { n: s.newGuests, visits: s.visitors }),
        },
        { label: t("tiles.new"), value: s.newAccounts, note: t("tiles.newNote") },
        {
          label: t("tiles.banned"),
          value: s.banned,
          note: t("tiles.bannedNote"),
          onClick: () => setChip("banned"),
        },
      ]
    : [];

  const exportCsv = async () => {
    const qs = new URLSearchParams({ format: "csv", filter: chip, sort });
    if (search.debounced.trim()) qs.set("q", search.debounced.trim());
    const res = await fetch(`/api/v1/admin/users?${qs}`, { credentials: "same-origin" });
    if (res.ok) downloadText("spil-users.csv", await res.text());
  };

  return (
    <>
      <PageHeader title={tn("users")}>
        <SearchBox value={search.value} onChange={search.onChange} placeholder={t("searchPh")} />
        <OutlineButton onClick={exportCsv}>{tc("exportCsv")}</OutlineButton>
      </PageHeader>
      {s && (
        // Hairlines between tiles come from the 1 px gap over the line colour.
        <section
          aria-label={t("summary")}
          className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3 xl:grid-cols-6"
        >
          {tiles.map((tile) => {
            const body = (
              <>
                <span className="text-[13px] leading-none font-medium text-text-muted">
                  {tile.label}
                </span>
                <span className="font-mono text-[30px] leading-none font-semibold tracking-[-0.03em]">
                  {tile.value}
                </span>
                <span className="font-mono text-[12px] leading-[1.3] font-medium text-text-muted">
                  {tile.note}
                </span>
              </>
            );
            return tile.onClick ? (
              <button
                key={tile.label}
                type="button"
                onClick={tile.onClick}
                className="grid content-start gap-2.5 border-0 bg-surface p-5 text-left text-text hover:bg-surface-raised"
              >
                {body}
              </button>
            ) : (
              <div key={tile.label} className="grid content-start gap-2.5 bg-surface p-5">
                {body}
              </div>
            );
          })}
        </section>
      )}
      <Chips<Chip>
        label={tn("users")}
        value={chip}
        onChange={setChip}
        items={CHIPS.map((c) => ({ value: c, label: t(`chips.${c}`) }))}
      />
      {canAct && picked.size > 0 && (
        <BulkBar picked={picked} onClear={() => setPicked(new Map())} />
      )}
      {q.isError && !data ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : !data ? (
        <TableSkeleton label={tc("loading")} />
      ) : (
        <DataTable
          caption={tn("users")}
          cols={[
            ...(canAct
              ? [
                  {
                    label: t("selectPage"),
                    width: 44,
                    node: (
                      <span className="grid place-items-center">
                        <Checkbox
                          aria-label={t("selectPage")}
                          checked={allOn ? true : someOn ? "indeterminate" : false}
                          onCheckedChange={(on) =>
                            setPicked(
                              on
                                ? new Map(pickable.map((u) => [u.userId, u.username ?? ""]))
                                : new Map(),
                            )
                          }
                        />
                      </span>
                    ),
                  },
                ]
              : []),
            { label: t("cols.username"), ...sortCol("name") },
            { label: t("cols.games"), width: 96, right: true, ...sortCol("games") },
            { label: t("cols.wins"), width: 80, right: true, noPhone: true, wide: true },
            {
              label: t("cols.points"),
              width: 100,
              right: true,
              noPhone: true,
              ...sortCol("points"),
            },
            { label: t("cols.crews"), width: 80, right: true, noPhone: true, wide: true },
            { label: t("cols.joined"), width: 140, noPhone: true, ...sortCol("joined") },
            { label: t("cols.lastSeen"), width: 130, ...sortCol("seen") },
          ]}
          empty={data.total === 0}
          emptyText={search.debounced.trim() || chip !== "all" ? t("noMatch") : t("empty")}
          total={data.total}
          page={paging.page}
          size={paging.size}
          onPage={paging.setPage}
          onSize={paging.setSize}
          busy={q.isPlaceholderData}
        >
          {rows.map((u) => {
            const name = u.username ?? t("noName");
            return (
              <Tr key={u.userId} selected={picked.has(u.userId)}>
                {canAct && (
                  <td className="w-11 px-2.5 py-3 text-center align-middle">
                    <span className="grid place-items-center">
                      <Checkbox
                        aria-label={t("select", { name })}
                        checked={picked.has(u.userId)}
                        onCheckedChange={(on) =>
                          setPicked((m) => {
                            const next = new Map(m);
                            if (on) next.set(u.userId, u.username ?? "");
                            else next.delete(u.userId);
                            return next;
                          })
                        }
                      />
                    </span>
                  </td>
                )}
                <Td bold>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => set({ user: u.userId })}
                      aria-label={t("open", { name })}
                      className={cn(
                        "max-w-full truncate border-0 bg-transparent p-0 text-left text-[14px] font-semibold text-text underline-offset-4 hover:text-accent-ink hover:underline",
                        !u.username && "font-normal text-text-muted",
                      )}
                    >
                      {name}
                    </button>
                    {u.kind === "guest" && (
                      <Tooltip content={t("guestTagHint")}>
                        <span
                          tabIndex={0}
                          aria-description={t("guestTagHint")}
                          className="shrink-0 rounded-pill border border-line-strong px-2 py-0.5 font-mono text-[11px] leading-none font-semibold tracking-wide text-text-muted uppercase"
                        >
                          {t("guestTag")}
                        </span>
                      </Tooltip>
                    )}
                    {u.banned && (
                      <span className="shrink-0 rounded-pill bg-error px-2 py-0.5 font-mono text-[11px] leading-none font-semibold tracking-wide text-on-accent uppercase">
                        {u.bannedUntil
                          ? t("bannedTagUntil", { date: when(u.bannedUntil) })
                          : t("bannedTag")}
                      </span>
                    )}
                  </span>
                </Td>
                <Td mono right>
                  {u.games}
                </Td>
                <Td mono right noPhone wide>
                  {u.wins}
                </Td>
                <Td mono right noPhone>
                  {u.points}
                </Td>
                <Td mono right noPhone wide>
                  {u.crews}
                </Td>
                <Td muted nowrap noPhone>
                  {when(u.createdAt)}
                </Td>
                <Td muted nowrap>
                  {u.lastSeen ? ago(u.lastSeen) : t("never")}
                </Td>
                <td className="py-2 pr-2.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => set({ user: u.userId })}
                    aria-label={t("open", { name })}
                    className="relative inline-grid size-10 place-items-center rounded-pill border-0 bg-transparent text-text-muted after:absolute after:-inset-1 after:content-[''] hover:bg-surface-raised hover:text-text"
                  >
                    <CaretRightIcon aria-hidden size={18} />
                  </button>
                </td>
              </Tr>
            );
          })}
        </DataTable>
      )}
      <UserSheet id={openId} onClose={() => set({ user: null })} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

function BulkBar({ picked, onClear }: { picked: Map<string, string>; onClear: () => void }) {
  const t = useTranslations("admin.users");
  const run = useAdminAction();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [banning, setBanning] = useState(false);
  const ids = [...picked.keys()];
  const go = async (action: "kick" | "signout" | "unban") => {
    const r = await run(() =>
      adminApi<{ done: number; skipped: number }>("POST", "/users/bulk", { action, ids }),
    );
    if (r.data) {
      toast(r.data.skipped ? t("bulkSkipped", r.data) : t("bulkDone", r.data));
      onClear();
    }
  };
  return (
    <section
      aria-label={t("selected", { n: picked.size })}
      className="sticky top-2 z-[3] flex flex-wrap items-center gap-2 rounded-card border border-accent bg-surface-raised px-4 py-3 shadow-[0_12px_32px_-16px_var(--shadow)]"
    >
      <span className="mr-auto font-mono text-[14px] leading-none font-semibold">
        {t("selected", { n: picked.size })}
      </span>
      <OutlineButton onClick={() => go("kick")}>{t("bulkKick")}</OutlineButton>
      <OutlineButton onClick={() => go("signout")}>{t("bulkSignOut")}</OutlineButton>
      <OutlineButton onClick={() => go("unban")}>{t("bulkUnban")}</OutlineButton>
      <OutlineButton danger onClick={() => setBanning(true)}>
        {t("bulkBan")}
      </OutlineButton>
      <OutlineButton onClick={onClear} className="border-transparent">
        {t("clearSelection")}
      </OutlineButton>
      <BanDialog
        key={banning ? "ban-open" : "ban-closed"}
        open={banning}
        onClose={() => setBanning(false)}
        title={t("banDialog.bulkTitle", { n: picked.size })}
        onBan={async (body) => {
          const r = await run(() =>
            adminApi<{ done: number; skipped: number }>("POST", "/users/bulk", {
              action: "ban",
              ids,
              ...body,
            }),
          );
          if (r.data) {
            toast(r.data.skipped ? t("bulkSkipped", r.data) : t("bulkDone", r.data));
            onClear();
            setBanning(false);
          }
          return r.message;
        }}
      />
      <ConfirmDialog state={confirm} setState={setConfirm} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function UserSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("admin.users");
  const td = useTranslations("admin.users.detail");
  const tm = useTranslations("modes");
  const me = useMe();
  const canAct = can(me.role, "users.act");
  const canDelete = can(me.role, "users.delete");
  const ago = useAgo();
  const run = useAdminAction();
  const toast = useToast();
  const q = useAdminQuery<AdminUserDetail>(`/users/${id}`, !!id);
  const u = id ? q.data : undefined;
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [dialog, setDialog] = useState<null | "ban" | "rename" | "delete">(null);
  const name = u?.username ?? td("title");
  const refused = { FORBIDDEN: t("adminRefused") };

  const act = (body: Record<string, unknown>, ok: string, errors?: Record<string, string>) =>
    run(() => adminApi<{ rooms?: number }>("POST", `/users/${id}`, body), {
      ok,
      errors: { ...refused, ...errors },
    });

  const modeName = (mode: string) => (tm.has(`${mode}.name`) ? tm(`${mode}.name`) : mode);

  return (
    <Sheet
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      title={u ? name : td("title")}
      closeButton
      className="lg:w-[600px]"
    >
      {!u ? (
        q.isError ? (
          <p className="m-0 text-[15px] text-text-muted">{td("notFound")}</p>
        ) : (
          <SkeletonGroup label={td("loading")} className="gap-3">
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </SkeletonGroup>
        )
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{u.kind === "account" ? td("account") : td("guest")}</Tag>
            {u.liveRooms > 0 && <Tag accent>{td("liveNow", { n: u.liveRooms })}</Tag>}
            {u.ban && <Tag danger>{t("bannedTag")}</Tag>}
          </div>

          {u.ban && (
            <div className="grid gap-1 rounded-card border border-error bg-surface p-4 text-[14px] leading-[1.45]">
              <span className="font-semibold">
                {td("banBy", { by: u.ban.by || "?", when: ago(u.ban.at) })}
              </span>
              <span className="text-text-muted">
                {u.ban.until ? td("banUntil", { date: when(u.ban.until) }) : td("banForever")}
              </span>
              {u.ban.reason && (
                <span className="text-text-muted">{td("banReason", { reason: u.ban.reason })}</span>
              )}
            </div>
          )}

          <dl className="m-0 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-5">
            {(
              [
                ["games", u.stats?.games ?? 0],
                ["wins", u.stats?.wins ?? 0],
                ["points", u.stats?.points ?? 0],
                ["hosted", u.stats?.hosted ?? 0],
                ["bullseyes", u.stats?.bullseyes ?? 0],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid gap-1.5 bg-surface px-3 py-3">
                <dt className="text-[12px] leading-none font-medium text-text-muted">{td(k)}</dt>
                <dd className="m-0 font-mono text-[22px] leading-none font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[14px] leading-[1.4]">
            <Fact label={td("joined")}>{when(u.createdAt)}</Fact>
            <Fact label={td("lastSeen")}>{u.lastSeen ? ago(u.lastSeen) : t("never")}</Fact>
            <Fact label={td("ageBand")}>
              {u.ageBand && t.has(`ageBands.${u.ageBand}`) ? t(`ageBands.${u.ageBand}`) : "?"}
            </Fact>
            <Fact label={td("sessions")}>{td("sessionsValue", { n: u.sessions })}</Fact>
            <Fact label={td("daily")}>{u.dailyAnswers}</Fact>
          </dl>

          {u.nicknames.length > 0 && (
            <Block title={td("names")}>
              <div className="flex flex-wrap gap-1.5">
                {u.nicknames.map((n) => (
                  <Tag key={n}>{n}</Tag>
                ))}
              </div>
            </Block>
          )}

          <Block title={td("rooms")}>
            {u.rooms.length === 0 ? (
              <Empty>{td("noRooms")}</Empty>
            ) : (
              <ul className="m-0 grid list-none gap-0 overflow-hidden rounded-card border border-line p-0">
                {u.rooms.map((r) => (
                  <li
                    key={r.playerId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3.5 py-2.5 text-[14px] first:border-t-0"
                  >
                    <span className="font-mono font-semibold">{r.code}</span>
                    <span className="min-w-0 flex-1 truncate text-text-muted">
                      {modeName(r.mode)} · {r.nickname}
                    </span>
                    {r.isHost && (
                      <CrownSimpleIcon
                        aria-label={td("host")}
                        size={16}
                        className="text-accent-ink"
                      />
                    )}
                    <span className="text-[13px] text-text-muted">
                      <StatusLabel status={r.status} />
                    </span>
                    {r.playerStatus !== "active" && (
                      <Tag>
                        {t.has(`playerStatus.${r.playerStatus}`)
                          ? t(`playerStatus.${r.playerStatus}`)
                          : r.playerStatus}
                      </Tag>
                    )}
                    <span className="font-mono text-[12px] text-text-muted">{ago(r.joinedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title={td("crews")}>
            {u.crews.length === 0 ? (
              <Empty>{td("noCrews")}</Empty>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {u.crews.map((c) => (
                  <Tag key={c.crewId}>{c.name}</Tag>
                ))}
              </div>
            )}
          </Block>

          <Block title={`${td("reports")} (${u.reportsAgainstTotal})`}>
            {u.reportsAgainst.length === 0 ? (
              <Empty>{td("noReports")}</Empty>
            ) : (
              <ul className="m-0 grid list-none gap-1.5 p-0 text-[14px]">
                {u.reportsAgainst.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                    <span className="text-[13px] text-text-muted">
                      <StatusLabel status={r.status} />
                    </span>
                    <span className="font-mono text-[12px] text-text-muted">
                      {ago(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 mt-2 text-[13px] text-text-muted">
              {td("reportsBy", { n: u.reportsBy })}
            </p>
          </Block>

          {canAct && (
            <Block title={td("actions")}>
              <div className="flex flex-wrap gap-2">
                <OutlineButton onClick={() => setDialog("rename")}>{td("rename")}</OutlineButton>
                {u.liveRooms > 0 && (
                  <OutlineButton
                    onClick={() =>
                      setConfirm({
                        title: t("kickTitle", { name }),
                        body: t("kickBody"),
                        cta: t("kickCta"),
                        run: async () => {
                          const r = await act({ action: "kick" }, "");
                          // The toast names how many rooms they left.
                          if (r.data) toast(t("kickDone", { n: r.data.rooms ?? 0, name }));
                        },
                      })
                    }
                  >
                    <UserMinusIcon aria-hidden size={18} />
                    {td("kick")}
                  </OutlineButton>
                )}
                <OutlineButton
                  onClick={() =>
                    setConfirm({
                      title: t("signOutTitle", { name }),
                      body: u.kind === "account" ? t("signOutBodyAccount") : t("signOutBodyGuest"),
                      cta: t("signOutCta"),
                      run: async () => {
                        await act({ action: "signout" }, t("signOutDone", { name }));
                      },
                    })
                  }
                >
                  <SignOutIcon aria-hidden size={18} />
                  {td("signOut")}
                </OutlineButton>
                {u.ban ? (
                  <OutlineButton onClick={() => act({ action: "unban" }, t("unbanDone", { name }))}>
                    {td("unban")}
                  </OutlineButton>
                ) : (
                  <OutlineButton danger onClick={() => setDialog("ban")}>
                    <ProhibitIcon aria-hidden size={18} />
                    {td("ban")}
                  </OutlineButton>
                )}
                {canDelete && (
                  <OutlineButton danger onClick={() => setDialog("delete")}>
                    {td("delete")}
                  </OutlineButton>
                )}
              </div>
            </Block>
          )}

          <BanDialog
            key={`ban-${dialog === "ban"}`}
            open={dialog === "ban"}
            onClose={() => setDialog(null)}
            title={t("banDialog.title", { name })}
            onBan={async (body) => {
              const r = await act({ action: "ban", ...body }, t("banDialog.done", { name }));
              if (!r.code) setDialog(null);
              return r.message;
            }}
          />
          <RenameDialog
            key={`rename-${dialog === "rename"}`}
            open={dialog === "rename"}
            onClose={() => setDialog(null)}
            name={name}
            account={u.kind === "account"}
            onRename={async (next) => {
              const r = await act(
                { action: "rename", name: next },
                t("renameDone", { name: next }),
                {
                  USERNAME_INVALID: t("renameInvalid"),
                  NAME_INVALID: t("renameInvalid"),
                  USERNAME_TAKEN: t("renameTaken"),
                  NAME_TAKEN: t("renameTaken"),
                },
              );
              if (!r.code) setDialog(null);
              return r.message;
            }}
          />
          <DeleteDialog
            key={`delete-${dialog === "delete"}`}
            open={dialog === "delete"}
            onClose={() => setDialog(null)}
            name={name}
            onDelete={async (typed) => {
              const r = await act({ action: "delete", confirm: typed }, t("deleteDone", { name }));
              if (!r.code) {
                setDialog(null);
                onClose();
              }
              return r.message;
            }}
          />
          <ConfirmDialog state={confirm} setState={setConfirm} />
        </div>
      )}
    </Sheet>
  );
}

function Tag({
  children,
  accent,
  danger,
}: {
  children: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-1 text-[12px] leading-none font-semibold",
        danger
          ? "border-error bg-error text-on-accent"
          : accent
            ? "border-accent bg-accent-soft text-accent-ink"
            : "border-line-strong text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h3 className="m-0 font-mono text-[12px] leading-none font-semibold tracking-[.06em] text-text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[14px] text-text-muted">{children}</p>;
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function BanDialog({
  open,
  onClose,
  title,
  onBan,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onBan: (body: { reason: string; days: 1 | 7 | 30 | null }) => Promise<string | null>;
}) {
  const t = useTranslations("admin.users.banDialog");
  const [length, setLength] = useState<BanLength>("7");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      error={error}
      busy={busy}
      submitLabel={t("cta")}
      danger
      onSubmit={async () => {
        setBusy(true);
        const message = await onBan({
          reason: reason.trim(),
          days: length === "forever" ? null : (Number(length) as 1 | 7 | 30),
        });
        setBusy(false);
        setError(message);
      }}
    >
      <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("body")}</p>
      <FieldRow id="ban-length" label={t("length")}>
        <Select
          id="ban-length"
          value={length}
          onValueChange={(v) => setLength(v as BanLength)}
          options={[
            { value: "1", label: t("days1") },
            { value: "7", label: t("days7") },
            { value: "30", label: t("days30") },
            { value: "forever", label: t("forever") },
          ]}
        />
      </FieldRow>
      <FieldRow id="ban-reason" label={t("reason")} hint={t("reasonHint")}>
        <TextArea
          id="ban-reason"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby="ban-reason-hint"
        />
      </FieldRow>
    </FormDialog>
  );
}

function RenameDialog({
  open,
  onClose,
  name,
  account,
  onRename,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  account: boolean;
  onRename: (name: string) => Promise<string | null>;
}) {
  const t = useTranslations("admin.users");
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("renameTitle", { name })}
      error={error}
      busy={busy}
      onSubmit={async () => {
        setBusy(true);
        setError(await onRename(value.trim()));
        setBusy(false);
      }}
    >
      <FieldRow
        id="rename-name"
        label={account ? t("renameLabelAccount") : t("renameLabelGuest")}
        hint={account ? t("renameHintAccount") : t("renameHintGuest")}
      >
        <Input
          id="rename-name"
          value={value}
          maxLength={account ? 20 : 16}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="rename-name-hint"
          autoComplete="off"
        />
      </FieldRow>
    </FormDialog>
  );
}

function DeleteDialog({
  open,
  onClose,
  name,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onDelete: (typed: string) => Promise<string | null>;
}) {
  const t = useTranslations("admin.users");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === name.toLowerCase();
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("deleteTitle", { name })}
      error={error}
      busy={busy}
      danger
      submitDisabled={!matches}
      submitLabel={t("deleteCta")}
      onSubmit={async () => {
        if (!matches) return;
        setBusy(true);
        setError(await onDelete(typed));
        setBusy(false);
      }}
    >
      <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("deleteBody")}</p>
      <FieldRow id="delete-confirm" label={t("deleteConfirm", { name })}>
        <Input
          id="delete-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </FieldRow>
    </FormDialog>
  );
}
