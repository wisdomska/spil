import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResetForm } from "@/components/admin/ResetForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reset");
  return { title: t("title") };
}

export default function AdminResetPage() {
  // Reads ?code= / ?token_hash= from the reset email link, so it renders behind Suspense.
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
