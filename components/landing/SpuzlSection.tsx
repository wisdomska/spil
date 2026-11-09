import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";

/**
 * The landing page's link to SPUZL, Senya's puzzle games app (owner request 2026-11-09): one
 * compact card, the same way SPUZL's own site points to SPIL. Opens in a new tab.
 */
export async function SpuzlSection() {
  const t = await getTranslations("landing.spuzl");
  return (
    <section
      aria-labelledby="spuzl-title"
      className="mx-auto box-border w-full max-w-[1200px] px-5 py-10"
    >
      <div className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="grid max-w-[60ch] gap-2">
          <span className="font-mono text-[12px] leading-none font-semibold tracking-[.08em] text-accent-ink uppercase">
            {t("kicker")}
          </span>
          <h2
            id="spuzl-title"
            className="m-0 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-.02em]"
          >
            {t("title")}
          </h2>
          <p className="m-0 text-[16px] leading-[1.5] text-pretty text-text-muted">{t("body")}</p>
        </div>
        <a
          href="https://spuzl.vercel.app"
          target="_blank"
          rel="noopener"
          className="flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-pill border-[1.5px] border-line-strong px-6 text-[16px] leading-none font-semibold text-text no-underline hover:border-text hover:text-text active:scale-[.97] sm:self-center"
        >
          {t("cta")}
          <ArrowUpRightIcon size={18} aria-hidden />
          <span className="sr-only">{t("newTab")}</span>
        </a>
      </div>
    </section>
  );
}
