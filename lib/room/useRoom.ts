"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import type { AnswerValue } from "@/lib/game";
import { BACKOFF_MS, useAnswerQueue } from "./answerQueue";

export const roomKey = (code: string) => ["room", code] as const;

/**
 * The room's state. Realtime invalidates it on every event; when realtime is not live (or
 * polling_only is on) it polls every 5 s. It also refetches every 30 s as the heartbeat the
 * server uses for host handover.
 */
export function useRoomState(code: string, live: { current: boolean }) {
  return useQuery({
    queryKey: roomKey(code),
    queryFn: () => api<RoomState>("GET", `/rooms/${code}/state`),
    refetchInterval: () => (live.current ? 30_000 : 5_000),
    refetchIntervalInBackground: true,
    retry: (count, error) =>
      count < 3 && !(error instanceof ClientApiError && error.status >= 400 && error.status < 500),
  });
}

/** Room actions; each returns the fresh state, which replaces the cache. */
export function useRoomActions(code: string) {
  const qc = useQueryClient();
  const setState = async (state: RoomState | Record<string, never>) => {
    // SPIL-14: a state fetch still in flight may have read the room before this action, so it
    // must not land after the action's fresh state and put the old screen back (the "ignored
    // first tap"). Cancelling it could also drop a refresh a realtime event asked for, so one
    // more fetch follows; it starts after the action, so it is never older than it.
    const { fetchStatus } = qc.getQueryState(roomKey(code)) ?? {};
    await qc.cancelQueries({ queryKey: roomKey(code) });
    if (state && "room" in state) qc.setQueryData(roomKey(code), state);
    if (fetchStatus === "fetching" || !(state && "room" in state))
      qc.invalidateQueries({ queryKey: roomKey(code) });
  };
  const call = (method: string, path: string, body?: unknown) =>
    api<RoomState>(method, `/rooms/${code}${path}`, body).then(async (s) => {
      await setState(s);
      return s;
    });
  const start = useMutation({ mutationFn: () => call("POST", "/start") });
  const kick = useMutation({
    mutationFn: (playerId: string) => call("POST", "/kick", { playerId }),
  });
  const nudge = useMutation({
    mutationFn: (playerId: string) => api("POST", `/rooms/${code}/nudge`, { playerId }),
  });
  const advance = useMutation({
    mutationFn: (from: "answering" | "guessing" | "ready") => call("POST", "/advance", { from }),
  });
  const skipToReveal = useMutation({ mutationFn: () => call("POST", "/skip-to-reveal") });
  const revealNext = useMutation({
    mutationFn: (expected: number) => call("POST", "/reveal/next", { expected }),
  });
  const revealSkip = useMutation({ mutationFn: () => call("POST", "/reveal/skip") });
  const submitAnswers = useMutation({ mutationFn: () => call("POST", "/answers/submit") });
  const submitGuesses = useMutation({ mutationFn: () => call("POST", "/guesses/submit") });
  const patchMe = useMutation({
    mutationFn: (body: { spillMode?: boolean; hideNameOnCard?: boolean }) =>
      call("PATCH", "/me", body),
  });
  const leave = useMutation({ mutationFn: () => api("DELETE", `/rooms/${code}/me`) });
  // SPIL-18: one-tap rematch with the same pack, and the host's series reset.
  const rematch = useMutation({ mutationFn: () => call("POST", "/rematch", {}) });
  const resetSeries = useMutation({ mutationFn: () => call("POST", "/series/reset") });
  const addTestPlayers = useMutation({
    mutationFn: (count: number) => call("POST", "/test-players", { count }),
  });
  return {
    start,
    rematch,
    resetSeries,
    kick,
    nudge,
    advance,
    skipToReveal,
    revealNext,
    revealSkip,
    submitAnswers,
    submitGuesses,
    patchMe,
    leave,
    addTestPlayers,
  };
}

/**
 * Optimistic answers with an offline queue: record locally, push the batch, retry with backoff
 * (1, 2, 4 ... 30 s) and again whenever the browser comes back online.
 */
export function useAnswerSync(code: string, round: number | undefined) {
  const key = `${code}:${round ?? 0}`;
  const qc = useQueryClient();
  const pending = useAnswerQueue((s) => s.pending[key]);
  const add = useAnswerQueue((s) => s.add);
  const confirm = useAnswerQueue((s) => s.confirm);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<Promise<boolean> | null>(null);
  const retry = useRef<() => void>(() => {});
  const isEmpty = () => !Object.keys(useAnswerQueue.getState().pending[key] ?? {}).length;

  /** Sends one batch. true when it landed (or was refused for good), false on a transient error. */
  const sendOnce = useCallback(
    async (batch: Record<string, AnswerValue>): Promise<boolean> => {
      try {
        const saved = await api<{ answered: number }>("PUT", `/rooms/${code}/answers`, {
          answers: Object.entries(batch).map(([questionId, value]) => ({ questionId, value })),
        });
        confirm(key, batch);
        // Keep my own row right without waiting for a refetch (SPIL-03).
        qc.setQueryData<RoomState>(roomKey(code), (s) =>
          s && s.room.round === round
            ? {
                ...s,
                myAnswers: { ...s.myAnswers, ...batch },
                players: s.players.map((p) =>
                  p.id === s.me.id ? { ...p, answered: saved.answered } : p,
                ),
              }
            : s,
        );
        attempt.current = 0;
        setOffline(false);
        return true;
      } catch (e) {
        const transient =
          !(e instanceof ClientApiError) ||
          e.code === "OFFLINE" ||
          e.status >= 500 ||
          e.status === 429;
        if (!transient) {
          // The phase moved on or the answer was refused: nothing more to send.
          useAnswerQueue.getState().clear(key);
          return true;
        }
        setOffline(e instanceof ClientApiError && e.code === "OFFLINE");
        const delay = BACKOFF_MS[Math.min(attempt.current++, BACKOFF_MS.length - 1)]!;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => retry.current(), delay);
        return false;
      }
    },
    [code, confirm, key, qc, round],
  );

  /**
   * Sends everything queued, waiting for any request already in flight, until the queue is
   * empty. Resolves true when the server has every answer, false if it gave up for now.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!round) return false;
    for (let guard = 0; guard < 8; guard++) {
      if (inflight.current) {
        await inflight.current;
        continue;
      }
      const batch = useAnswerQueue.getState().pending[key];
      if (!batch || !Object.keys(batch).length) return true;
      setSaving(true);
      const request = sendOnce({ ...batch });
      inflight.current = request;
      const ok = await request;
      inflight.current = null;
      setSaving(false);
      if (!ok) return false;
    }
    return isEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, round, sendOnce]);
  useEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

  useEffect(() => {
    const on = () => {
      setOffline(false);
      attempt.current = 0;
      void flush();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (!navigator.onLine) off();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearTimeout(timer.current);
    };
  }, [flush]);

  // Retry anything left over from before a refresh.
  useEffect(() => {
    if (!pending || !Object.keys(pending).length) return;
    const id = setTimeout(() => void flush(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const record = useCallback(
    (questionId: string, value: AnswerValue) => {
      add(key, questionId, value);
      void flush();
    },
    [add, flush, key],
  );

  return {
    record,
    pending: pending ?? {},
    saving: saving || Boolean(pending && Object.keys(pending).length),
    offline,
    flush,
  };
}
