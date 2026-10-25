import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IntlScope } from "@/components/site/IntlScope";
import { TvApp } from "@/components/tv/TvApp";

export async function generateMetadata({ params }: PageProps<"/r/[code]/tv">): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations("meta");
  return {
    title: t("tvTitle", { code: code.toUpperCase() }),
    robots: { index: false, follow: false },
  };
}

async function Tv({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.t === "string" ? query.t : "";
  return (
    <IntlScope scope="tv">
      <TvApp code={code.toUpperCase()} token={token} />
    </IntlScope>
  );
}

/** Party Mode: the big screen a host pairs with the room. */
export default function TvPage({ params, searchParams }: PageProps<"/r/[code]/tv">) {
  return (
    <Suspense>
      <Tv params={params} searchParams={searchParams} />
    </Suspense>
  );
}
