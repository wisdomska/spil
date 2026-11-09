import {
  ArrowUpRightIcon,
  CrownSimpleIcon,
  SwordIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";

const SPUZL_URL = "https://spuzl.vercel.app";

/** SPUZL's four worlds and their games, as its own site lists them (checked 2026-11-09). */
const WORLDS = [
  {
    key: "puzzles",
    games: [
      ["Crownfall", "crownfall"],
      ["Dusk", "dusk"],
      ["Sixer", "sixer"],
      ["Nine", "nine"],
      ["Weave", "weave"],
      ["Flowline", "flowline"],
      ["Pairup", "pairup"],
      ["Lost", "lost"],
      ["Trotro Jam", "trotro"],
    ],
  },
  {
    key: "words",
    games: [
      ["Coil", "coil"],
      ["Rungs", "rungs"],
      ["Quads", "quads"],
      ["Seven", "seven"],
      ["Minicross", "minicross"],
      ["Buried", "buried"],
      ["Remix", "remix"],
      ["Quickfire", "quickfire"],
      ["Emoji Hits", "emojihits"],
    ],
  },
  {
    key: "arcade",
    games: [
      ["Echo", "echo"],
      ["Twins", "twins"],
      ["Flinch", "flinch"],
      ["Beat Tap", "beattap"],
      ["Gotcha", "gotcha"],
      ["Dash", "dash"],
    ],
  },
  {
    key: "board",
    games: [
      ["Chess", "chess"],
      ["Draughts", "draughts"],
      ["Oware", "oware"],
      ["Ludo", "ludo"],
      ["Four Up", "fourup"],
    ],
  },
] as const;

const SOCIAL: Array<{ key: "duel" | "party" | "leagues"; Icon: Icon }> = [
  { key: "duel", Icon: SwordIcon },
  { key: "party", Icon: UsersThreeIcon },
  { key: "leagues", Icon: TrophyIcon },
];

/**
 * A solved 4 × 4 Crownfall, SPUZL's opening puzzle: four colour regions (shades of ink here,
 * since SPIL has one accent) and one crown per row, column and region, none touching.
 */
const REGIONS = [
  [0, 0, 0, 1],
  [2, 0, 1, 1],
  [2, 2, 3, 1],
  [2, 3, 3, 3],
] as const;
const CROWNS = [1, 3, 0, 2] as const; // crown column in each row
const SHADE = [
  "bg-tile-on-paper/10",
  "bg-tile-on-paper/30",
  "bg-tile-on-paper/55",
  "bg-tile-on-paper/80",
] as const;

/**
 * The landing page's SPUZL section (owner requests 2026-11-02 and 2026-11-09): Senya's puzzle
 * games app, in its own words from spuzl.vercel.app, mirroring the SPIL card on SPUZL. Every
 * link opens in a new tab so SPIL stays open.
 */
export async function SpuzlSection() {
  const t = await getTranslations("landing.spuzl");
  const stats = [
    [t("statGames"), t("statGamesLabel")],
    [t("statWorlds"), t("statWorldsLabel")],
    [t("statFree"), t("statFreeLabel")],
  ] as const;
  const rules = t.raw("boardRules") as string[];

  return (
    <section
      aria-labelledby="spuzl-title"
      className="mx-auto box-border w-full max-w-[1200px] border-t border-line px-5 py-14"
    >
      <div className="grid gap-10 rounded-card bg-tile-paper p-6 text-tile-on-paper sm:p-10">
        {/* Pitch and a solved puzzle */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div className="grid content-start gap-4">
            <span className="font-mono text-[12px] leading-none font-semibold tracking-[.08em] uppercase">
              {t("kicker")}
            </span>
            <h2
              id="spuzl-title"
              className="m-0 font-display text-[clamp(38px,6vw,64px)] leading-[.94] font-extrabold tracking-[-.035em] text-balance"
            >
              {t("title")}
            </h2>
            <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-[clamp(24px,3vw,30px)] leading-none font-extrabold tracking-[-.02em]">
                SPUZL
              </span>
              <span className="text-[17px] leading-[1.3] font-semibold">{t("tagline")}</span>
            </p>
            <p className="m-0 max-w-[52ch] text-[17px] leading-[1.5] text-pretty">{t("body")}</p>
            <div className="mt-2 grid justify-items-start gap-3">
              <a
                href={SPUZL_URL}
                target="_blank"
                rel="noopener"
                className="flex h-14 items-center justify-center gap-2 rounded-pill bg-tile-on-paper px-7 text-[17px] leading-none font-semibold text-tile-paper no-underline hover:text-tile-paper hover:opacity-90 active:scale-[.97]"
              >
                {t("cta")}
                <ArrowUpRightIcon size={18} aria-hidden />
                <span className="sr-only">{t("newTab")}</span>
              </a>
              <span className="text-[14px] leading-[1.4] font-medium">{t("guest")}</span>
            </div>
          </div>

          <figure className="m-0 grid w-full max-w-[400px] gap-4 justify-self-center rounded-[18px] border-[1.5px] border-tile-on-paper/15 p-5 lg:justify-self-end">
            <figcaption className="grid gap-2.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[24px] leading-none font-extrabold tracking-[-.02em]">
                  {t("boardName")}
                </span>
                <span className="font-mono text-[12px] leading-none font-semibold">
                  {t("boardSize")}
                </span>
              </span>
              <ul className="m-0 grid list-none gap-1.5 p-0 text-[14px] leading-[1.35] font-medium">
                {rules.map((rule) => (
                  <li key={rule} className="flex items-center gap-2">
                    <CrownSimpleIcon aria-hidden size={14} weight="fill" className="shrink-0" />
                    {rule}
                  </li>
                ))}
              </ul>
            </figcaption>
            <div
              role="img"
              aria-label={t("boardLabel")}
              className="grid aspect-square grid-cols-4 gap-1 rounded-[12px] border-[1.5px] border-tile-on-paper p-1"
            >
              {REGIONS.flatMap((row, r) =>
                row.map((region, c) => (
                  <span
                    key={`${r}-${c}`}
                    className={cn("grid place-items-center rounded-[6px]", SHADE[region])}
                  >
                    {CROWNS[r] === c && (
                      <CrownSimpleIcon
                        aria-hidden
                        weight="fill"
                        className={cn(
                          "size-[45%]",
                          region >= 2 ? "text-tile-paper" : "text-tile-on-paper",
                        )}
                      />
                    )}
                  </span>
                )),
              )}
            </div>
          </figure>
        </div>

        {/* Numbers */}
        <dl
          aria-label={t("stats")}
          className="m-0 grid grid-cols-3 border-y-[1.5px] border-tile-on-paper/15 py-5"
        >
          {stats.map(([value, label]) => (
            <div key={label} className="grid justify-items-center gap-1.5">
              <dt className="sr-only">{label}</dt>
              <dd className="m-0 font-display text-[clamp(30px,5vw,48px)] leading-none font-extrabold tracking-[-.03em]">
                {value}
              </dd>
              <dd aria-hidden className="m-0 font-mono text-[12px] leading-none font-semibold">
                {label}
              </dd>
            </div>
          ))}
        </dl>

        {/* The four worlds, every game linked */}
        <div className="grid gap-4">
          <h3 className="m-0 font-display text-[clamp(24px,3vw,30px)] leading-none font-extrabold tracking-[-.02em]">
            {t("worldsTitle")}
          </h3>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {WORLDS.map(({ key, games }) => (
              <li
                key={key}
                className="grid content-start gap-3 rounded-[16px] border-[1.5px] border-tile-on-paper/15 p-4"
              >
                <span className="grid gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[17px] leading-[1.2] font-bold">
                      {t(`worlds.${key}.title`)}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] leading-none font-semibold">
                      {t("worldCount", { n: games.length })}
                    </span>
                  </span>
                  <span className="text-[14px] leading-[1.35]">{t(`worlds.${key}.body`)}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {games.map(([name, slug]) => (
                    <a
                      key={slug}
                      href={`${SPUZL_URL}/games/${slug}`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-pill border-[1.5px] border-tile-on-paper/20 px-2.5 py-1.5 text-[13px] leading-none font-semibold text-tile-on-paper no-underline hover:border-tile-on-paper hover:text-tile-on-paper"
                    >
                      {name}
                      <span className="sr-only"> {t("newTab")}</span>
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <a
            href={`${SPUZL_URL}/games`}
            target="_blank"
            rel="noopener"
            className="flex w-fit items-center gap-1.5 text-[15px] leading-none font-semibold text-tile-on-paper underline underline-offset-4 hover:text-tile-on-paper"
          >
            {t("allGames")}
            <ArrowUpRightIcon size={16} aria-hidden />
            <span className="sr-only">{t("newTab")}</span>
          </a>
        </div>

        {/* Playing together */}
        <div className="grid gap-4">
          <h3 className="m-0 font-display text-[clamp(24px,3vw,30px)] leading-none font-extrabold tracking-[-.02em]">
            {t("friendsTitle")}
          </h3>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {SOCIAL.map(({ key, Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-tile-on-paper text-tile-paper">
                  <Icon aria-hidden size={20} weight="bold" />
                </span>
                <span className="grid gap-0.5">
                  <span className="text-[16px] leading-[1.3] font-bold">{t(`${key}.title`)}</span>
                  <span className="text-[14px] leading-[1.4] text-pretty">{t(`${key}.body`)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[14px] leading-[1.4] font-medium">{t("offline")}</p>
        </div>
      </div>
    </section>
  );
}
