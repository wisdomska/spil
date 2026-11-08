import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "./SiteHeader";
import { TabScroller } from "./TabScroller";
import { cn } from "@/lib/cn";

export type InfoTab = "howto" | "games" | "faq" | "privacy" | "terms" | "safety" | "contact";
const TABS: Array<[InfoTab, string]> = [
  ["howto", "/how-to-play"],
  ["games", "/games"],
  ["faq", "/faq"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["safety", "/safety"],
  ["contact", "/contact"],
];

/**
 * Long-form page shell: header, pill tab bar between the help pages, 720 max column. On
 * narrow phones the tabs scroll sideways inside the bar, never the page (SPIL-06).
 */
export async function InfoPage({ tab, children }: { tab: InfoTab; children: React.ReactNode }) {
  // A game's own page sits under the Games tab.
  const t = await getTranslations();
  const label = (k: InfoTab) => (k === "howto" ? t("common.howToPlay") : t(`pages.${k}`));
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/" narrow />
      {/* Same column as the header pill, so header, tabs and text share one left edge. */}
      <div className="mx-auto box-border w-[calc(100%-24px)] max-w-[720px] pt-1 pb-14">
        <TabScroller
          label={t("pages.tabs")}
          className="mt-3 mb-8 flex w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-pill border border-line bg-surface p-1 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(([k, href]) => (
            <Link
              key={k}
              href={href}
              aria-current={k === tab ? "page" : undefined}
              className={cn(
                "flex h-11 flex-none items-center justify-center rounded-pill px-3 text-[14px] leading-none font-semibold whitespace-nowrap no-underline sm:flex-auto sm:px-4 lg:h-12 lg:text-[15px]",
                k === tab
                  ? "bg-surface-raised text-text shadow-[0_1px_0_var(--line)] hover:text-text"
                  : "text-text-muted hover:bg-surface-raised hover:text-text",
              )}
            >
              {label(k)}
            </Link>
          ))}
        </TabScroller>
        <article className="grid gap-[18px] px-2 text-[18px] leading-[1.65] sm:px-3">
          {children}
        </article>
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
