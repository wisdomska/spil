import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo";
import { InfoPage, PageTitle, Section } from "@/components/site/InfoPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.safetyPage");
  return pageMetadata({ title: t("title"), description: t("description"), path: "/safety" });
}

/** SPIL-06: how SPIL keeps play kind and private, and who can play. */
export default async function Safety() {
  const t = await getTranslations("pages.safetyPage");
  return (
    <InfoPage tab="safety">
      <PageTitle>{t("title")}</PageTitle>
      <Section title={t("h1")}>{t("p1")}</Section>
      <Section title={t("h2")}>{t("p2")}</Section>
      <Section title={t("h3")}>{t("p3")}</Section>
      <Section title={t("h4")}>{t("p4")}</Section>
      <Section title={t("h5")}>{t("p5")}</Section>
    </InfoPage>
  );
}
