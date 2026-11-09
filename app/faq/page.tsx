import type { Metadata } from "next";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
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
      {/* Native disclosure: works without JavaScript, keyboard and screen readers get it for free,
          and closed answers stay in the HTML for search engines and AI answers. */}
      <div className="grid border-t border-line">
        {items.map((i, n) => (
          <details key={i.q} open={n === 0} className="group border-b border-line">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
              <h2 className="m-0 font-display text-[20px] leading-[1.2] font-extrabold text-balance">
                {i.q}
              </h2>
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong text-text-muted group-open:border-text group-open:text-text"
              >
                <PlusIcon size={16} weight="bold" className="group-open:hidden" />
                <MinusIcon size={16} weight="bold" className="hidden group-open:block" />
              </span>
            </summary>
            <p className="m-0 max-w-[62ch] pb-5 text-pretty">{i.a}</p>
          </details>
        ))}
      </div>
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
