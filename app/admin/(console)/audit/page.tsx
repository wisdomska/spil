import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuditSection } from "@/components/admin/sections/AuditSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("audit") };
}

export default function AuditPage() {
  return <AuditSection />;
}
