import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RoomApp } from "@/components/room/RoomApp";
import { IntlScope } from "@/components/site/IntlScope";

export async function generateMetadata({ params }: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations("meta");
  const upper = code.toUpperCase();
  return {
    title: t("roomTitle", { code: upper }),
    robots: { index: false, follow: false },
    openGraph: { images: [`/og/r/${upper}`], title: t("roomTitle", { code: upper }) },
    twitter: { card: "summary_large_image", images: [`/og/r/${upper}`] },
  };
}

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <IntlScope scope="room">
      <RoomApp code={code.toUpperCase()} />
    </IntlScope>
  );
}

export default function RoomPage({ params }: PageProps<"/r/[code]">) {
  return (
    <Suspense>
      <Room params={params} />
    </Suspense>
  );
}
