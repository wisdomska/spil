import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ConsoleShell } from "@/components/admin/ConsoleShell";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { findAdmin } from "@/lib/admin/server";
import { getUserId } from "@/lib/supabase/server";

/**
 * Server-side guard for every console page: no session, or a user who is not in `admins`, goes
 * to the sign-in page. The session read is request-time, so it streams behind Suspense
 * (Cache Components); the proxy already redirects most signed-out visits before this runs.
 */
async function Gate({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  const me = userId ? await findAdmin(userId) : null;
  if (!me) redirect("/admin/login");
  return <ConsoleShell me={me}>{children}</ConsoleShell>;
}

async function ShellSkeleton() {
  const t = await getTranslations("admin.nav");
  return (
    <SkeletonGroup label={t("loading")} className="min-h-[100dvh] lg:grid-cols-[248px_1fr]">
      <div className="hidden border-r border-line bg-surface p-5 lg:grid lg:content-start lg:gap-3">
        <Skeleton className="mb-3 h-7 w-28 rounded-input" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-pill" />
        ))}
      </div>
      <div className="grid content-start gap-5 p-6 lg:p-10">
        <Skeleton className="h-9 w-48 rounded-input" />
        <Skeleton className="h-[110px] rounded-card" />
        <Skeleton className="h-[260px] rounded-card" />
      </div>
    </SkeletonGroup>
  );
}

export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
