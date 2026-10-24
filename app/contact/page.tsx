import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InfoPage, Lede, PageTitle } from "@/components/site/InfoPage";
import { IntlScope } from "@/components/site/IntlScope";
import { ContactForm } from "./ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.contactPage");
  return { title: t("title"), description: t("lede") };
}

export default async function Contact() {
  const t = await getTranslations("pages.contactPage");
  return (
    <InfoPage tab="contact">
      <PageTitle>{t("title")}</PageTitle>
      <Lede>{t("lede")}</Lede>
      <IntlScope scope="contact">
        <ContactForm />
      </IntlScope>
      <p className="m-0 text-text-muted">
        {t("or")} <a href={`mailto:${t("address")}`}>{t("address")}</a>
      </p>
    </InfoPage>
  );
}
