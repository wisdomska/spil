import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoomsSection } from "@/components/admin/sections/RoomsSection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("rooms") };
}

export default function RoomsPage() {
  return <RoomsSection />;
}
