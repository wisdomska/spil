import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "./SiteHeader";
import { cn } from "@/lib/cn";

export type InfoTab = "howto" | "privacy" | "terms" | "contact";
const TABS: Array<[InfoTab, string]> = [
  ["howto", "/how-to-play"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["contact", "/contact"],
];

/** Long-form page shell: header, pill tab bar between the four pages, 720 max column. */
export async function InfoPage({ tab, children }: { tab: InfoTab; children: React.ReactNode }) {
  const t = await getTranslations();
  const label = (k: InfoTab) => (k === "howto" ? t("common.howToPlay") : t(`pages.${k}`));
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" howtoCurrent={tab === "howto"} />
      <div className="mx-auto box-border w-full max-w-[720px] px-5 pt-1 pb-14">
        <nav
          aria-label={t("pages.tabs")}
          className="mt-1 mb-7 grid w-full max-w-full grid-cols-4 gap-0.5 rounded-pill border border-line bg-surface p-1 lg:w-fit"
        >
          {TABS.map(([k, href]) => (
            <Link
              key={k}
              href={href}
              aria-current={k === tab ? "page" : undefined}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center rounded-pill px-1.5 text-[14px] leading-none font-semibold whitespace-nowrap no-underline lg:px-5 lg:text-[15px]",
                k === tab
                  ? "bg-surface-raised text-text shadow-[0_1px_0_var(--line)] hover:text-text"
                  : "text-text-muted hover:bg-surface-raised hover:text-text",
              )}
            >
              {label(k)}
            </Link>
          ))}
        </nav>
        <article className="grid gap-[18px] text-[18px] leading-[1.65]">{children}</article>
      </div>
    </div>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="m-0 font-display text-[52px] leading-[.95] font-extrabold tracking-[-.035em]">
      {children}
    </h1>
  );
}

export function Lede({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[20px] text-text-muted">{children}</p>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="m-0 mt-4 font-display text-[26px] leading-[1.1] font-extrabold">{title}</h2>
      <p className="m-0">{children}</p>
    </>
  );
}
