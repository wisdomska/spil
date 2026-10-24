import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { IntlScope } from "@/components/site/IntlScope";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.login");
  return { title: t("title") };
}

export default function AdminLoginPage() {
  // Signed-in admins are sent to the console by the proxy before this renders.
  return (
    <Suspense>
      <IntlScope scope="adminAuth">
        <LoginForm />
      </IntlScope>
    </Suspense>
  );
}
