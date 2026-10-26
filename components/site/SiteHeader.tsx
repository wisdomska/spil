"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ProfileMenu } from "@/components/site/ProfileMenu";
import { cn } from "@/lib/cn";

/** Floating pill header shared by the landing and pre-room screens (design: App header). */
export function SiteHeader({
  back,
  narrow,
}: {
  /** Where Back goes. Omit on the landing page (wordmark on the left instead). */
  back?: string;
  /** Match a 720 px reading column (info pages) instead of the full page width. */
  narrow?: boolean;
}) {
  const t = useTranslations("common");
  const router = useRouter();

  // The menu marks the current page, so it reads the URL: static pages prerender the slot.
  const menu = (
    <Suspense fallback={<span aria-hidden className="block size-12" />}>
      <ProfileMenu />
    </Suspense>
  );

  return (
    <header
      className={cn(
        "sticky top-3 mx-auto mt-3 w-[calc(100%-24px)] rounded-pill border border-line p-1.5",
        narrow ? "max-w-[720px]" : "max-w-[1160px]",
        "bg-[color-mix(in_oklab,var(--surface-raised)_80%,transparent)] shadow-[0_14px_32px_-20px_var(--shadow)] backdrop-blur-[14px] backdrop-saturate-[1.4]",
        back
          ? "grid grid-cols-[1fr_auto_1fr] items-center gap-2"
          : "flex items-center justify-between gap-3 pl-5",
      )}
      style={{ zIndex: "var(--z-sticky)" }}
    >
      {back ? (
        <>
          <span className="flex">
            <button
              type="button"
              aria-label={t("back")}
              onClick={() => (window.history.length > 1 ? router.back() : router.push(back))}
              className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[22px] text-text hover:bg-surface-raised active:scale-[.92]"
            >
              <ArrowLeftIcon aria-hidden />
            </button>
          </span>
          <Link href="/" className="flex justify-center text-text no-underline hover:text-text">
            <Wordmark size={26} />
          </Link>
          <span className="flex items-center justify-end gap-1">{menu}</span>
        </>
      ) : (
        <>
          <Link href="/" className="text-text no-underline hover:text-text">
            <Wordmark size={30} />
          </Link>
          <div className="flex items-center gap-1">{menu}</div>
        </>
      )}
    </header>
  );
}
