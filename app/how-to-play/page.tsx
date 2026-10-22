import { DoorOpenIcon, PlusCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { InfoPage, Lede, PageTitle, Section } from "@/components/site/InfoPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.howto");
  return { title: t("title"), description: t("p1") };
}

const ACCENT =
  "flex items-center justify-center gap-2 rounded-pill border-0 bg-accent font-semibold leading-none text-on-accent no-underline hover:text-on-accent hover:brightness-[1.08]";
const OUTLINE =
  "flex items-center justify-center gap-2 rounded-pill border-[1.5px] border-text font-semibold leading-none text-text no-underline hover:text-text";

export default async function HowToPlay() {
  const t = await getTranslations("pages.howto");
  const c = await getTranslations("common");
  return (
    <InfoPage tab="howto">
      <PageTitle>{t("title")}</PageTitle>
      <Lede>{t("lede", { min: 3 })}</Lede>
      <div className="flex flex-wrap gap-2.5">
        <Link href="/create" className={`${ACCENT} h-12 px-5 text-[15px]`}>
          {c("startRoom")}
        </Link>
        <Link href="/join" className={`${OUTLINE} h-12 px-5 text-[15px] hover:bg-surface-raised`}>
          {c("joinWithCode")}
        </Link>
      </div>
      <Section title={t("h1")}>{t("p1")}</Section>
      <Section title={t("h2")}>{t("p2")}</Section>
      <Section title={t("h3")}>{t("p3")}</Section>
      <Section title={t("h4")}>{t("p4")}</Section>
      <Section title={t("h5")}>{t("p5")}</Section>
      <div className="mt-5 grid gap-3.5 rounded-card bg-surface-raised p-6">
        <span className="font-display text-[28px] leading-none font-extrabold tracking-[-.02em]">
          {t("ready")}
        </span>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/create" className={`${ACCENT} h-14 flex-[1_1_200px] px-6 text-[17px]`}>
            <PlusCircleIcon size={20} aria-hidden />
            {c("startRoom")}
          </Link>
          <Link
            href="/join"
            className={`${OUTLINE} h-14 flex-[1_1_200px] px-6 text-[17px] hover:bg-surface`}
          >
            <DoorOpenIcon size={20} aria-hidden />
            {c("joinWithCode")}
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
