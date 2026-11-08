import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InfoPage, Lede, PageTitle } from "@/components/site/InfoPage";
import { JsonLd } from "@/components/site/JsonLd";
import { GAME_PAGES, gameFacts, gamePage, startHref } from "@/lib/game-pages";
import { absolute, pageMetadata } from "@/lib/seo";

/** Real prompts from each game's own pack (sample questions). */
const EXAMPLES: Partial<Record<string, string[]>> = {
  classic: [
    "Have you ever slept through morning prep?",
    "Have you ever spent your whole December budget in one week?",
    "Have you ever gone to the beach on Christmas Day?",
  ],
  hot_takes: [
    "Pineapple belongs on pizza.",
    "Voice notes longer than a minute should be illegal.",
    "Leaving someone on read is worse than not opening the message.",
  ],
  most_likely: [
    "Who's most likely to forget their own birthday?",
    "Who's most likely to become famous by accident?",
    "Who's most likely to get lost with the map open?",
  ],
  rank_room: [
    "Most likely to forget their own birthday",
    "Most likely to become famous by accident",
    "Most likely to get lost with the map open",
  ],
  red_green: [
    "They reply to every text within a minute.",
    "They post every hangout on their story.",
    "They cancel plans an hour before.",
  ],
  imposter: [
    "How much do you love pizza?",
    "How good are you at cooking?",
    "How scary are spiders?",
  ],
  who_said: [
    "What's the pettiest thing you've ever done?",
    "What's the worst date you've ever been on, in one line?",
  ],
};

export function generateStaticParams() {
  return GAME_PAGES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const page = gamePage((await params).slug);
  if (!page) return {};
  const t = await getTranslations("games");
  const tm = await getTranslations("modes");
  const name = tm(`${page.mode}.name`);
  return pageMetadata({
    title: `${name}: ${t(`modes.${page.mode}.tagline`)}`,
    description: t(`modes.${page.mode}.lede`),
    path: `/games/${page.slug}`,
  });
}

const ACCENT =
  "flex h-12 w-fit items-center justify-center rounded-pill bg-accent px-6 text-[16px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent hover:brightness-[1.08]";

/** One game's page: what it is, how a round goes, who can play, real examples, and a start link. */
export default async function GameDetailPage({ params }: PageProps<"/games/[slug]">) {
  const page = gamePage((await params).slug);
  if (!page) notFound();
  const { mode, slug } = page;
  const t = await getTranslations("games");
  const tm = await getTranslations("modes");
  const name = tm(`${mode}.name`);
  const steps = t.raw(`modes.${mode}.steps`) as string[];
  const { minPlayers, adultOnly } = gameFacts(mode);
  const examples = EXAMPLES[mode];
  const others = GAME_PAGES.filter((g) => g.slug !== slug);

  return (
    <InfoPage tab="games">
      <p className="m-0 font-mono text-[13px] leading-none font-semibold tracking-[.06em] text-accent-ink uppercase">
        <Link href="/games" className="text-accent-ink no-underline hover:underline">
          {t("indexTitle")}
        </Link>
      </p>
      <PageTitle>{name}</PageTitle>
      <Lede>{t(`modes.${mode}.tagline`)}</Lede>
      <p className="m-0">{t(`modes.${mode}.lede`)}</p>
      <ul aria-label={t("factsLabel")} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {[t("players", { min: minPlayers }), adultOnly ? t("age18") : t("ageAll"), t("free")].map(
          (f) => (
            <li
              key={f}
              className="rounded-pill border border-line-strong px-3 py-1.5 font-mono text-[13px] leading-none font-semibold"
            >
              {f}
            </li>
          ),
        )}
      </ul>
      <Link href={startHref(mode)} className={ACCENT}>
        {t("start", { game: name })}
      </Link>

      <h2 className="m-0 mt-4 font-display text-[26px] leading-[1.1] font-extrabold">
        {t("howTitle")}
      </h2>
      <ol className="m-0 grid gap-3 pl-6">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="m-0 text-text-muted">{t(`modes.${mode}.extra`)}</p>

      {examples && (
        <>
          <h2 className="m-0 mt-4 font-display text-[26px] leading-[1.1] font-extrabold">
            {t("examplesTitle")}
          </h2>
          <ul className="m-0 grid gap-2 pl-6">
            {examples.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="m-0 text-[15px] text-text-muted">{t("examplesNote")}</p>
        </>
      )}

      <h2 className="m-0 mt-4 font-display text-[26px] leading-[1.1] font-extrabold">
        {t("more")}
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {others.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/games/${g.slug}`}
              className="inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-4 text-[15px] leading-none font-semibold text-text no-underline hover:bg-surface-raised hover:text-text"
            >
              {tm(`${g.mode}.name`)}
            </Link>
          </li>
        ))}
      </ul>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: t("open", { game: name }),
            description: t(`modes.${mode}.lede`),
            totalTime: "PT15M",
            step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: t("breadcrumbHome"), item: absolute("/") },
              { "@type": "ListItem", position: 2, name: t("indexTitle"), item: absolute("/games") },
              { "@type": "ListItem", position: 3, name, item: absolute(`/games/${slug}`) },
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
