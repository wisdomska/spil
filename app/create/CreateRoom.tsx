"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PackPicker } from "@/components/game/PackPicker";
import { useToast } from "@/components/ui/Toast";
import { useTurnstile } from "@/components/ui/Turnstile";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";
import type { Pack } from "@/lib/api/types";

/**
 * Host flow: pick a pack and length, then the room is created and the host sets up their
 * profile. With ?room=CODE&mode=pack|rematch the same picker changes an existing room's pack.
 */
export function CreateRoom({
  packs,
  questionsPerGame,
}: {
  packs: Pack[];
  questionsPerGame: number;
}) {
  const t = useTranslations("packs");
  const tt = useTranslations("toast");
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const room = params.get("room");
  const mode = params.get("mode");
  const { getToken, element } = useTurnstile();
  const [busy, setBusy] = useState(false);

  const go = async (packId: string, questionCount: number) => {
    setBusy(true);
    try {
      if (room && (mode === "pack" || mode === "rematch")) {
        if (mode === "pack") await api("PATCH", `/rooms/${room}/pack`, { packId, questionCount });
        else await api("POST", `/rooms/${room}/rematch`, { packId, questionCount });
        router.push(`/r/${room}`);
        return;
      }
      // Turnstile tokens are single use: one for the anonymous sign-in, one for room creation.
      await ensureSession(getToken);
      const { code } = await api<{ code: string }>("POST", "/rooms", {
        packId,
        questionCount,
        captchaToken: await getToken(),
      });
      router.push(`/r/${code}/me`);
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      toast(
        code === "RATE_LIMITED"
          ? tt("rateLimited")
          : code === "PACK_UNAVAILABLE"
            ? tt("noPacks")
            : tt("somethingWrong"),
        "err",
      );
      setBusy(false);
    }
  };

  return (
    <>
      <PackPicker
        packs={packs}
        questionsPerGame={questionsPerGame}
        initialPack={params.get("pack") ?? undefined}
        cta={(name) => t("continue", { pack: name })}
        busy={busy}
        onContinue={go}
      />
      {element}
    </>
  );
}
