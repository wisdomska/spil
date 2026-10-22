import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Wordmark";

export async function SiteFooter() {
  const t = await getTranslations();
  const links = [
    ["/how-to-play", t("common.howToPlay")],
    ["/privacy", t("pages.privacy")],
    ["/terms", t("pages.terms")],
    ["/contact", t("pages.contact")],
  ] as const;
  return (
    <footer className="mx-auto box-border flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line px-5 pt-7 pb-10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Wordmark size={24} />
        <a
          href="https://wisdomska.site"
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-1.5 text-[14px] leading-[1.4] font-medium text-text-muted no-underline hover:text-text hover:underline"
        >
          {t("common.designedBy")}
          <ArrowUpRightIcon size={14} aria-hidden />
        </a>
      </div>
      <nav aria-label={t("common.footerNav")} className="-ml-3.5 flex flex-wrap gap-x-1">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex h-12 items-center rounded-pill px-3.5 text-[15px] leading-none font-semibold text-text-muted no-underline hover:bg-surface-raised hover:text-text"
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
