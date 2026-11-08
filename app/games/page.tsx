import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { InfoPage, Lede, PageTitle } from "@/components/site/InfoPage";
import { JsonLd } from "@/components/site/JsonLd";
import { GAME_PAGES, gameFacts } from "@/lib/game-pages";
import { absolute, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("games");
  return pageMetadata({
    title: t("indexMetaTitle"),
    description: t("indexDescription"),
    path: "/games",
  });
}

/** All ten games, each linking to its own page (SEO and GEO, owner request 2026-11-08). */
export default async function GamesPage() {
  const t = await getTranslations("games");
  const tm = await getTranslations("modes");
  return (
    <InfoPage tab="games">
      <PageTitle>{t("indexTitle")}</PageTitle>
      <Lede>{t("indexLede")}</Lede>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {GAME_PAGES.map(({ mode, slug }) => {
          const { minPlayers, adultOnly } = gameFacts(mode);
          return (
            <li key={slug}>
              <Link
                href={`/games/${slug}`}
                className="group grid h-full gap-2 rounded-card border border-line bg-surface p-4 text-text no-underline hover:bg-surface-raised hover:text-text"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-[22px] leading-[1.1] font-extrabold">
                    {tm(`${mode}.name`)}
                  </span>
                  <CaretRightIcon
                    aria-hidden
                    size={18}
                    weight="bold"
                    className="shrink-0 text-accent-ink transition-transform group-hover:translate-x-0.5"
                  />
                </span>
                <span className="text-[15px] leading-[1.45] text-text-muted">
                  {tm(`${mode}.body`)}
                </span>
                <span className="font-mono text-[12px] leading-none font-semibold text-text-muted">
                  {t("players", { min: minPlayers })} · {adultOnly ? t("age18") : t("ageAll")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("indexTitle"),
          itemListElement: GAME_PAGES.map(({ mode, slug }, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: tm(`${mode}.name`),
            url: absolute(`/games/${slug}`),
          })),
        }}
      />
    </InfoPage>
  );
}
