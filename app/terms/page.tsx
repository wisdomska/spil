import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InfoPage, Lede, PageTitle, Section } from "@/components/site/InfoPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.termsPage");
  return { title: t("title"), description: t("lede") };
}

export default async function Terms() {
  const t = await getTranslations("pages.termsPage");
  return (
    <InfoPage tab="terms">
      <PageTitle>{t("title")}</PageTitle>
      <Lede>{t("lede")}</Lede>
      <Section title={t("hAge")}>{t("pAge")}</Section>
      <Section title={t("h1")}>{t("p1")}</Section>
      <Section title={t("h2")}>{t("p2")}</Section>
      <Section title={t("h3")}>{t("p3")}</Section>
      <Section title={t("h4")}>{t("p4")}</Section>
    </InfoPage>
  );
}
