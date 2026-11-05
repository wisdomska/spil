import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UsersSection } from "@/components/admin/sections/UsersSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("users") };
}

export default function UsersPage() {
  return <UsersSection />;
}
