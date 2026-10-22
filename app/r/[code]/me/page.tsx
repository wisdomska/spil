import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProfileForm } from "./ProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title"), robots: { index: false } };
}

async function Profile({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ProfileForm code={code.toUpperCase()} />;
}

export default function ProfilePage({ params }: PageProps<"/r/[code]/me">) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader back="/join" />
      {/* The code and the random starting avatar are per visit, so they stream in. */}
      <Suspense>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}
