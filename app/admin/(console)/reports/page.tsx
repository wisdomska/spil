import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportsSection } from "@/components/admin/sections/ReportsSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("reports") };
}

export default function ReportsPage() {
  return <ReportsSection />;
}
