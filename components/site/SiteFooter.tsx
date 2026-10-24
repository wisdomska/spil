import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Wordmark";

/** Landing footer: wordmark and credit, then one row of help links that wraps on phones. */
export async function SiteFooter() {
  const t = await getTranslations();
  const links = [
    ["/how-to-play", t("common.howToPlay")],
    ["/safety", t("pages.safety")],
    ["/privacy", t("pages.privacy")],
    ["/terms", t("pages.terms")],
    ["/contact", t("pages.contact")],
  ] as const;
  return (
    <footer className="mx-auto box-border grid w-full max-w-[1200px] gap-3 border-t border-line px-5 pt-7 pb-10">
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
      <nav aria-label={t("common.footerNav")} className="flex flex-wrap gap-x-4">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center text-[14px] leading-none font-medium text-text-muted no-underline hover:text-text"
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
