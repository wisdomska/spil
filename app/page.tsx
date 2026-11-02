import { ArrowUpRightIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { RoomsCounter } from "@/components/landing/RoomsCounter";
import { FocusAfterLeave } from "@/components/landing/FocusAfterLeave";
import { ShareDemo } from "@/components/landing/ShareDemo";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { IntlScope } from "@/components/site/IntlScope";

export default async function Landing() {
  const t = await getTranslations("landing");
  const c = await getTranslations("common");
  const steps = [
    [t("answer"), t("answerBody"), false],
    [t("guess"), t("guessBody"), false],
    [t("spill"), t("spillBody"), true],
  ] as const;

  return (
    <IntlScope scope="landing">
      <div className="[container-type:inline-size] flex min-h-[100dvh] flex-col">
        <SiteHeader />
        <main className="flex flex-col">
          <section className="mx-auto box-border flex w-full max-w-[1200px] flex-wrap items-center gap-x-16 gap-y-10 px-5 pt-5 pb-16">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[22px]">
              <h1 className="m-0 font-display text-display-xl leading-[.92] font-extrabold tracking-[-.035em] text-balance">
                {t("headline")}{" "}
                <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
                  {t("headlineEmphasis")}
                </span>
              </h1>
              <p className="m-0 max-w-[460px] text-body-l text-pretty text-text-muted">
                {t("lede")}
              </p>
              <div className="flex max-w-[520px] flex-wrap gap-2.5">
                <Link
                  id="start-room"
                  href="/create"
                  className="flex h-14 flex-[1_1_200px] items-center justify-center rounded-pill bg-accent px-7 text-[17px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent hover:shadow-[inset_0_0_0_99px_var(--press-glow)] active:scale-[.97]"
                >
                  {c("startRoom")}
                </Link>
                <Link
                  href="/join"
                  className="flex h-14 flex-[1_1_200px] items-center justify-center rounded-pill border-[1.5px] border-text px-6 text-[17px] leading-none font-semibold text-text no-underline hover:bg-surface-raised hover:text-text active:scale-[.97]"
                >
                  {c("joinWithCode")}
                </Link>
              </div>
              <RoomsCounter />
              <FocusAfterLeave targetId="start-room" />
              <span className="flex items-center gap-2 text-[14px] leading-[1.4] font-medium text-text-muted">
                <LockSimpleIcon size={18} aria-hidden />
                {c("privacyLine")}
              </span>
            </div>
            <HeroDemo />
          </section>

          <section className="mx-auto box-border grid w-full max-w-[1200px] gap-7 border-t border-line px-5 py-12">
            <h2 className="m-0 font-display text-[36px] leading-none font-extrabold tracking-[-.03em]">
              {t("roundTitle")}
            </h2>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-8 p-0">
              {steps.map(([title, body, accent]) => (
                <li
                  key={title}
                  className={`grid content-start gap-2.5 border-t-2 pt-[18px] pb-7 ${accent ? "border-accent" : "border-text"}`}
                >
                  <span
                    className={`font-display text-[56px] leading-[.9] font-extrabold tracking-[-.02em] ${accent ? "text-accent-ink" : ""}`}
                    style={{ fontStretch: "75%" }}
                  >
                    {title}
                  </span>
                  <p className="m-0 text-[17px] leading-[1.5] text-text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </section>

          <ShareDemo />

          <section
            aria-labelledby="spuzl-title"
            className="mx-auto box-border w-full max-w-[1200px] border-t border-line px-5 py-14"
          >
            <div className="grid items-center gap-6 rounded-card bg-tile-paper p-7 text-tile-on-paper sm:grid-cols-[minmax(0,1fr)_auto] sm:p-10">
              <div className="grid gap-3">
                <span className="font-mono text-[12px] leading-none font-semibold tracking-[.08em] uppercase">
                  {t("spuzlKicker")}
                </span>
                <h2
                  id="spuzl-title"
                  className="m-0 font-display text-[clamp(40px,6vw,64px)] leading-[.95] font-extrabold tracking-[-.035em]"
                >
                  SPUZL
                </h2>
                <p className="m-0 max-w-[44ch] text-[18px] leading-[1.45] text-pretty">
                  {t("spuzlBody")}
                </p>
              </div>
              <a
                href="https://spuzl.vercel.app"
                target="_blank"
                rel="noopener"
                className="flex h-14 items-center justify-center gap-2 rounded-pill bg-tile-on-paper px-7 text-[17px] leading-none font-semibold text-tile-paper no-underline hover:text-tile-paper hover:opacity-90 active:scale-[.97]"
              >
                {t("spuzl")}
                <ArrowUpRightIcon size={18} aria-hidden />
                <span className="sr-only">{t("spuzlNewTab")}</span>
              </a>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </IntlScope>
  );
}
