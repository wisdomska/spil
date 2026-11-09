"use client";

import {
  CalendarCheckIcon,
  CloudCheckIcon,
  SignOutIcon,
  CaretDownIcon,
  GearSixIcon,
  HashIcon,
  PlusCircleIcon,
  ListIcon,
  MedalIcon,
  QuestionIcon,
  UserCircleIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Avatar, AVATAR_COUNT } from "@/components/brand/Avatar";
import { useToast } from "@/components/ui/Toast";
import { clearAccount, useDeviceAccount } from "@/lib/account/device";
import { useAccountsReady } from "@/lib/account/ready";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { parseProfile, profileSnapshot, subscribeProfile } from "@/lib/profile/device";

type Item = {
  href: string;
  key: "start" | "join" | "badges" | "crews" | "daily" | "howTo" | "settings";
  Icon: Icon;
};

// Start and Join come first: on inner pages this menu is the only way back to a game.
const ITEMS: Item[] = [
  { href: "/create", key: "start", Icon: PlusCircleIcon },
  { href: "/join", key: "join", Icon: HashIcon },
  { href: "/badges", key: "badges", Icon: MedalIcon },
  { href: "/crews", key: "crews", Icon: UsersThreeIcon },
  { href: "/daily", key: "daily", Icon: CalendarCheckIcon },
  { href: "/how-to-play", key: "howTo", Icon: QuestionIcon },
  { href: "/profile", key: "settings", Icon: GearSixIcon },
];

/** A drag this far right (or a quick flick) closes the phone panel. */
const SWIPE_CLOSE_PX = 80;
const SWIPE_CLOSE_VELOCITY = 500;

/** The name and face this phone remembers (SPIL-17), live across tabs and the profile page. */
export function useDeviceProfile() {
  const raw = useSyncExternalStore(subscribeProfile, profileSnapshot, () => null);
  return useMemo(() => parseProfile(raw, AVATAR_COUNT), [raw]);
}

/**
 * The header's profile menu (owner request 2026-10-26). Desktop: face and name opening a
 * dropdown. Phones: one menu button opening a panel from the right (Radix Dialog gives the focus
 * trap, Escape and scrim close; a swipe right closes it too). The current page is marked.
 * Never shown inside rooms, which have their own header.
 */
export function ProfileMenu() {
  const t = useTranslations("menu");
  const path = usePathname();
  const profile = useDeviceProfile();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const name = profile?.nickname ?? t("guest");
  const account = useDeviceAccount();
  // Signed in: always offer Sign out. Otherwise only once accounts are switched on.
  const showAccount = useAccountsReady() || Boolean(account);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  // Saving is offered until this phone signs in; then the menu offers Sign out.
  const signOut = async () => {
    setOpen(false);
    try {
      await api("POST", "/account/sign-out");
    } catch {
      // Signed out locally either way; the server session expires on its own.
    }
    clearAccount();
    // The profile page reads the account from this query; without this it kept "Signed in as".
    qc.setQueryData(["account"], { account: null });
    toast(t("signedOut"));
    router.refresh();
  };
  const accountRow = account
    ? { key: "signOut" as const, Icon: SignOutIcon }
    : { key: "save" as const, Icon: CloudCheckIcon, href: "/profile#account" };
  const isCurrent = (href: string) => path === href || path.startsWith(`${href}/`);

  const face = (size: number) =>
    profile ? (
      <Avatar n={profile.avatar} size={size} decorative />
    ) : (
      <UserCircleIcon aria-hidden size={size} />
    );

  return (
    <>
      {/* Desktop: face and name, opening a dropdown. */}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          aria-label={t("openNamed", { name })}
          className="hidden h-12 items-center gap-2.5 rounded-pill border-0 bg-transparent pr-3.5 pl-1.5 text-[15px] leading-none font-semibold text-text hover:bg-surface-raised data-[state=open]:bg-surface-raised lg:flex"
        >
          {face(36)}
          <span className="max-w-[16ch] truncate">{name}</span>
          <CaretDownIcon aria-hidden size={14} weight="bold" className="text-text-muted" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={10}
            className="grid w-[260px] animate-modal-pop gap-0.5 rounded-card border border-line bg-surface-raised p-1.5 text-text shadow-[0_18px_40px_-18px_var(--shadow)]"
            style={{ zIndex: "var(--z-sheet)" }}
          >
            {ITEMS.map(({ href, key, Icon }) => (
              <DropdownMenu.Item key={key} asChild>
                <Link
                  href={href}
                  aria-current={isCurrent(href) ? "page" : undefined}
                  className="flex h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] leading-none font-semibold text-text no-underline outline-none hover:text-text aria-[current=page]:text-accent-ink data-highlighted:bg-surface"
                >
                  <Icon aria-hidden size={20} />
                  {t(key)}
                </Link>
              </DropdownMenu.Item>
            ))}
            {showAccount && <DropdownMenu.Separator className="my-1 h-px bg-line" />}
            {account && (
              <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-[13px] leading-none text-text-muted">
                {t("signedInAs", { username: account })}
              </DropdownMenu.Label>
            )}
            {showAccount && (
              <DropdownMenu.Item
                asChild
                onSelect={accountRow.href ? undefined : () => void signOut()}
              >
                {accountRow.href ? (
                  <Link
                    href={accountRow.href}
                    className="flex h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] leading-none font-semibold text-accent-ink no-underline outline-none hover:text-accent-ink data-highlighted:bg-surface"
                  >
                    <accountRow.Icon aria-hidden size={20} />
                    {t(accountRow.key)}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="flex h-11 w-full items-center gap-3 rounded-[12px] border-0 bg-transparent px-3 text-left text-[15px] leading-none font-semibold text-text outline-none data-highlighted:bg-surface"
                  >
                    <accountRow.Icon aria-hidden size={20} />
                    {t(accountRow.key)}
                  </button>
                )}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Phones: one menu button, a panel from the right. */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          aria-label={t("open")}
          className="grid size-12 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-text hover:bg-surface-raised active:scale-[.92] lg:hidden"
        >
          <ListIcon aria-hidden size={22} />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 animate-fade bg-scrim"
            style={{ zIndex: "var(--z-sheet)" }}
          />
          <Dialog.Content asChild aria-describedby={undefined}>
            <motion.div
              drag={reduced ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.6 }}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.x > SWIPE_CLOSE_PX || info.velocity.x > SWIPE_CLOSE_VELOCITY)
                  setOpen(false);
              }}
              className="fixed inset-y-0 right-0 grid w-[min(340px,88vw)] animate-panel-in touch-pan-y content-start gap-5 overflow-y-auto rounded-l-card border-l border-line bg-surface-raised pt-[max(16px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-[max(24px,env(safe-area-inset-bottom))] pl-4 text-text outline-none"
              style={{ zIndex: "calc(var(--z-sheet) + 1)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <Dialog.Title className="m-0 font-display text-[28px] leading-none font-extrabold tracking-[-0.02em]">
                  {t("title")}
                </Dialog.Title>
                <Dialog.Close
                  aria-label={t("close")}
                  className="grid size-12 place-items-center rounded-pill border border-line bg-transparent text-text hover:bg-surface active:scale-[.92]"
                >
                  <XIcon aria-hidden size={20} />
                </Dialog.Close>
              </div>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 text-text no-underline hover:text-text"
              >
                {face(48)}
                <span className="grid min-w-0 gap-1">
                  <span className="truncate text-[17px] leading-none font-bold">{name}</span>
                  <span className="truncate text-[14px] leading-none text-text-muted">
                    {account ? t("signedInAs", { username: account }) : t("onThisPhone")}
                  </span>
                </span>
              </Link>
              <nav aria-label={t("title")}>
                <ul className="m-0 grid list-none gap-1 p-0">
                  {ITEMS.map(({ href, key, Icon }) => (
                    <li key={key}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={isCurrent(href) ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center gap-3.5 rounded-[14px] px-3 text-[17px] leading-none font-semibold text-text no-underline hover:bg-surface hover:text-text",
                          "aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink",
                        )}
                      >
                        <Icon aria-hidden size={22} />
                        {t(key)}
                      </Link>
                    </li>
                  ))}
                  {showAccount && (
                    <li className="mt-2 border-t border-line pt-2">
                      {accountRow.href ? (
                        <Link
                          href={accountRow.href}
                          onClick={() => setOpen(false)}
                          className="flex min-h-12 items-center gap-3.5 rounded-[14px] px-3 text-[17px] leading-none font-semibold text-accent-ink no-underline hover:bg-surface hover:text-accent-ink"
                        >
                          <accountRow.Icon aria-hidden size={22} />
                          {t(accountRow.key)}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void signOut()}
                          className="flex min-h-12 w-full items-center gap-3.5 rounded-[14px] border-0 bg-transparent px-3 text-left text-[17px] leading-none font-semibold text-text hover:bg-surface"
                        >
                          <accountRow.Icon aria-hidden size={22} />
                          {t(accountRow.key)}
                        </button>
                      )}
                    </li>
                  )}
                </ul>
              </nav>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
