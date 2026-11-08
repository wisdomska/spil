import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InfoPage, Lede, PageTitle } from "@/components/site/InfoPage";
import { JsonLd } from "@/components/site/JsonLd";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("faq");
  return pageMetadata({ title: t("metaTitle"), description: t("description"), path: "/faq" });
}

/** Short answers to what people ask, marked up as an FAQ for search and AI answers. */
export default async function FaqPage() {
  const t = await getTranslations("faq");
  const items = t.raw("items") as Array<{ q: string; a: string }>;
  return (
    <InfoPage tab="faq">
      <PageTitle>{t("title")}</PageTitle>
      <Lede>{t("lede")}</Lede>
      {items.map((i) => (
        <section key={i.q} className="grid gap-2">
          <h2 className="m-0 mt-3 font-display text-[24px] leading-[1.15] font-extrabold">{i.q}</h2>
          <p className="m-0">{i.a}</p>
        </section>
      ))}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((i) => ({
            "@type": "Question",
            name: i.q,
            acceptedAnswer: { "@type": "Answer", text: i.a },
          })),
        }}
      />
    </InfoPage>
  );
}
