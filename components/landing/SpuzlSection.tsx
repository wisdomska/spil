import {
  ArrowUpRightIcon,
  SwordIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { getTranslations } from "next-intl/server";

const SPUZL_URL = "https://spuzl.vercel.app";

/** SPUZL's eight worlds, as its own site names them. */
const WORLDS = ["logic", "line", "shape", "words", "clues", "reflex", "rage", "board"] as const;

const SOCIAL: Array<{ key: "duel" | "party" | "leagues"; Icon: Icon }> = [
  { key: "duel", Icon: SwordIcon },
  { key: "party", Icon: UsersThreeIcon },
  { key: "leagues", Icon: TrophyIcon },
];

/**
 * The landing page's SPUZL section (owner request 2026-11-02): Senya's puzzle games app, in its
 * own words from spuzl.vercel.app. Opens in a new tab so SPIL stays open.
 */
export async function SpuzlSection() {
  const t = await getTranslations("landing.spuzl");
  const stats = [
    [t("statGames"), t("statGamesLabel")],
    [t("statWorlds"), t("statWorldsLabel")],
    [t("statFree"), t("statFreeLabel")],
  ] as const;

  return (
    <section
      aria-labelledby="spuzl-title"
      className="mx-auto box-border w-full max-w-[1200px] border-t border-line px-5 py-14"
    >
      <div className="grid gap-10 rounded-card bg-tile-paper p-7 text-tile-on-paper sm:p-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        <div className="grid content-start gap-4">
          <span className="font-mono text-[12px] leading-none font-semibold tracking-[.08em] uppercase">
            {t("kicker")}
          </span>
          <h2
            id="spuzl-title"
            className="m-0 font-display text-[clamp(44px,7vw,72px)] leading-[.92] font-extrabold tracking-[-.035em]"
          >
            SPUZL
          </h2>
          <p className="m-0 font-display text-[clamp(22px,3vw,30px)] leading-[1.1] font-extrabold tracking-[-.02em] text-balance">
            {t("tagline")}
          </p>
          <p className="m-0 max-w-[48ch] text-[17px] leading-[1.5] text-pretty">{t("body")}</p>
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

        <div className="grid content-start gap-7">
          <dl className="m-0 grid grid-cols-3 gap-3">
            {stats.map(([value, label]) => (
              <div
                key={label}
                className="grid gap-1.5 rounded-[16px] border-[1.5px] border-tile-on-paper/15 px-4 py-3.5"
              >
                <dt className="sr-only">{label}</dt>
                <dd className="m-0 font-display text-[clamp(26px,3.4vw,36px)] leading-none font-extrabold tracking-[-.03em]">
                  {value}
                </dd>
                <dd aria-hidden className="m-0 font-mono text-[12px] leading-none font-semibold">
                  {label}
                </dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-3">
            <h3 className="m-0 text-[15px] leading-none font-bold">{t("worldsTitle")}</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {WORLDS.map((w) => (
                <li
                  key={w}
                  className="rounded-pill border-[1.5px] border-tile-on-paper/20 px-3 py-1.5 text-[14px] leading-none font-semibold"
                >
                  {t(`worlds.${w}`)}
                </li>
              ))}
            </ul>
            <p className="m-0 text-[14px] leading-[1.45] text-pretty">{t("board")}</p>
          </div>

          <ul className="m-0 grid list-none gap-3.5 p-0">
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
        </div>
      </div>
    </section>
  );
}
