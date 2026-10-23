import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InboxSection } from "@/components/admin/sections/InboxSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("inbox") };
}

export default function InboxPage() {
  return <InboxSection />;
}
