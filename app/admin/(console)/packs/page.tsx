import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PacksSection } from "@/components/admin/sections/PacksSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("packs") };
}

export default function PacksPage() {
  return <PacksSection />;
}
