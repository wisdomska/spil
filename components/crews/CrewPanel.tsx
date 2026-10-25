"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ClientApiError } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import { MAX_CREW_NAME } from "@/lib/game";

/**
 * Crews on the results (Batch 3). The host can save the group as a crew; everyone else in the
 * room is offered it and joins by choice. Members see a link to the crew's season table.
 */
export function CrewPanel({ state }: { state: RoomState }) {
  const t = useTranslations("crews");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const crew = state.room.crew;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["room", state.room.code] });

  const fail = (e: unknown) => {
    const code = e instanceof ClientApiError ? e.code : "";
    toast(
      code === "TEXT_BLOCKED"
        ? tt("textBlocked")
        : code === "TEXT_CONTACT"
          ? tt("textContact")
          : code === "ROOM_FULL"
            ? tt("crewFull")
            : tt("somethingWrong"),
      "err",
    );
  };
  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ id: string; token: string }>("POST", "/crews", {
        roomCode: state.room.code,
        name: name.trim(),
      });
      setInvite(`${window.location.origin}/crew/join/${res.token}`);
      setNaming(false);
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    setBusy(true);
    try {
      await api("POST", "/crews/join", { roomCode: state.room.code });
      toast(tt("crewJoined", { name: crew?.name ?? "" }));
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite);
      toast(tt("crewLinkCopied"));
    } catch {
      toast(tt("somethingWrong"), "err");
    }
  };

  if (!crew && !state.me.isHost) return null;
  return (
    <section className="grid gap-3 rounded-card border border-line bg-surface p-4">
      <h2 className="m-0 font-display text-[22px] leading-none font-extrabold">
        {crew ? t("playingAs", { name: crew.name }) : t("saveTitle")}
      </h2>
      {!crew && !naming && (
        <>
          <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("saveBody")}</p>
          <Button size="md" variant="secondary" onClick={() => setNaming(true)}>
            {t("save")}
          </Button>
        </>
      )}
      {!crew && naming && (
        <div className="grid gap-2">
          <label htmlFor="crew-name" className="text-[15px] leading-none font-semibold">
            {t("nameLabel")}
          </label>
          <input
            id="crew-name"
            value={name}
            maxLength={MAX_CREW_NAME}
            onChange={(e) => setName(e.target.value)}
            className="box-border h-12 w-full rounded-input border border-line bg-surface-raised px-3.5 text-[16px] text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <Button size="md" softDisabled={!name.trim()} loading={busy} onClick={save}>
            {t("saveCta")}
          </Button>
        </div>
      )}
      {crew && !crew.member && (
        <>
          <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("joinBody")}</p>
          <Button size="md" loading={busy} onClick={join}>
            {t("join", { name: crew.name })}
          </Button>
        </>
      )}
      {crew && crew.member && (
        <>
          {invite && (
            <Button size="md" variant="secondary" onClick={copy}>
              {t("copyInvite")}
            </Button>
          )}
          <Link
            href={`/crew/${crew.id}`}
            className="text-[15px] leading-none font-semibold text-accent-ink underline underline-offset-4"
          >
            {t("openCrew")}
          </Link>
        </>
      )}
    </section>
  );
}
