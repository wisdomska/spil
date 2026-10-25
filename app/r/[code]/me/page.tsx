import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { JoinHeader } from "@/components/room/JoinHeader";
import { IntlScope } from "@/components/site/IntlScope";
import { SiteHeader } from "@/components/site/SiteHeader";
import { publicRoom } from "@/lib/api/publicRoom";
import type { PublicRoom } from "@/lib/api/types";
import { ProfileForm } from "./ProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title"), robots: { index: false } };
}

async function Profile({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await connection();
  // SPIL-19: read the room on the server so the header card is in the first paint and the form
  // needs no skeleton. Errors (no room, expired) are left to the form's own screens.
  const room: PublicRoom | null = await publicRoom(code.toUpperCase(), null).catch(() => null);
  return (
    <>
      {room && <JoinHeader room={room} />}
      <IntlScope scope="profile">
        <ProfileForm code={code.toUpperCase()} initialRoom={room ?? undefined} />
      </IntlScope>
    </>
  );
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
