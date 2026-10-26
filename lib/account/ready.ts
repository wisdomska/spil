"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** Whether accounts are switched on yet; until then every account entry point stays hidden. */
export function useAccountsReady() {
  const q = useQuery({
    queryKey: ["accounts-ready"],
    queryFn: () => api<{ ready: boolean }>("GET", "/account/ready"),
    staleTime: 10 * 60_000,
    retry: false,
  });
  return q.data?.ready === true;
}
