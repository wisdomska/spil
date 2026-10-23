"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/** Lobby-shaped loading state (design: "Lobby, loading skeleton"). */
export function RoomSkeleton() {
  const t = useTranslations("lobby");
  return (
    <SkeletonGroup label={t("loading")} className="gap-4">
      <Skeleton className="h-3 w-[90px] rounded-pill" />
      <Skeleton className="h-[72px] w-[240px] rounded-input" />
      <div className="flex gap-2">
        <Skeleton className="h-[52px] flex-1 rounded-pill" />
        <Skeleton className="size-[52px] rounded-pill" />
        <Skeleton className="size-[52px] rounded-pill" />
      </div>
      <Skeleton className="mt-3 h-[22px] w-[140px] rounded-pill" />
      <div className="flex flex-wrap gap-x-2.5 gap-y-3.5">
        <Skeleton className="h-[52px] w-[120px] rounded-pill" style={{ rotate: "-3deg" }} />
        <Skeleton className="h-[52px] w-[104px] rounded-pill" style={{ rotate: "2deg" }} />
        <Skeleton className="h-[52px] w-[130px] rounded-pill" style={{ rotate: "-1deg" }} />
      </div>
    </SkeletonGroup>
  );
}
