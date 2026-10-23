import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
