"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CODE_ALPHABET, CodeInput, cleanCode } from "@/components/ui/CodeInput";
import { api, ClientApiError } from "@/lib/api/client";
import type { PublicRoom } from "@/lib/api/types";
import { track } from "@/lib/analytics/posthog";

type JoinError = "invalid" | "expired" | "full" | "started" | "offline";

/** The code field and its actions. The page renders the heading, so it is in the static HTML. */
export function JoinForm() {
  const t = useTranslations("join");
  const c = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => cleanCode(params.get("code") ?? ""));
  const [error, setError] = useState<JoinError | null>(null);
  const [max, setMax] = useState(12);
  const [busy, setBusy] = useState(false);
  // SPIL-21: four characters a code can have, typed or pasted, look ready and join by themselves.
  const ready = code.length === 4 && [...code].every((ch) => CODE_ALPHABET.includes(ch));

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const room = await api<PublicRoom>("GET", `/rooms/${code}`);
      setMax(room.maxPlayers);
      if (room.status !== "lobby") return setError("started");
      if (room.playerCount >= room.maxPlayers) return setError("full");
      track("room_link_opened", { via: params.get("code") ? "link" : "code" });
      router.push(`/r/${code}/me`);
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      setError(code === "ROOM_EXPIRED" ? "expired" : code === "OFFLINE" ? "offline" : "invalid");
    } finally {
      setBusy(false);
    }
  };

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => void submitRef.current(), 150);
    return () => clearTimeout(id);
  }, [ready, code]);

  // Four characters a code can never have: say why instead of a silently disabled button.
  const badChars = !error && code.length === 4 && !ready;
  const message = badChars
    ? t("badChars")
    : error === "full"
      ? t("full", { max })
      : error === "offline"
        ? c("tryAgain")
        : error
          ? t(error)
          : null;

  return (
    <>
      <div className="grid gap-3">
        <label htmlFor="spil-code" className="text-[14px] leading-none font-semibold">
          {t("label")}
        </label>
        <CodeInput
          id="spil-code"
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onSubmit={submit}
          invalid={Boolean(error) || badChars}
          describedBy="spil-code-msg"
          autoFocus
        />
        <div id="spil-code-msg" role="alert" className="min-h-[22px]">
          {message && (
            <span className="flex items-start gap-2 text-[15px] leading-[1.4] font-medium text-error">
              <WarningCircleIcon size={20} aria-hidden className="shrink-0" />
              {message}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            let text = "";
            try {
              text = (await navigator.clipboard.readText()) ?? "";
            } catch {
              // clipboard blocked; nothing to paste
            }
            setCode(cleanCode(text));
            setError(null);
          }}
          className="-ml-2 flex h-12 items-center gap-2 justify-self-start rounded-pill border-0 bg-transparent px-4 text-[15px] leading-none font-semibold whitespace-nowrap text-text hover:bg-surface-raised"
        >
          {t("paste")}
        </button>
      </div>
      <div className="mt-auto grid gap-2.5">
        {error === "expired" && (
          <Link
            href="/create"
            className="flex h-14 items-center justify-center rounded-pill border-[1.5px] border-text text-[17px] leading-none font-semibold text-text no-underline hover:bg-surface-raised hover:text-text"
          >
            {c("startRoom")}
          </Link>
        )}
        <Button block softDisabled={!ready} loading={busy} onClick={submit}>
          {t("submit")}
        </Button>
        {/* Tertiary way out for people who landed here without an invite. The expired error
            already offers Start a game above, so it is not repeated then. */}
        {error !== "expired" && (
          <Link
            href="/create"
            className="flex h-12 items-center justify-center gap-2 rounded-pill text-[15px] leading-none font-semibold text-text-muted no-underline hover:bg-surface-raised hover:text-text"
          >
            {t("noCode")}
          </Link>
        )}
      </div>
    </>
  );
}
