import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsSection } from "@/components/admin/sections/SettingsSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("settings") };
}

export default function SettingsPage() {
  return <SettingsSection />;
}
