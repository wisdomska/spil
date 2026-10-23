"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AnswerValue } from "@/lib/game";

type Key = string; // `${code}:${round}`

type QueueState = {
  /** Answers not yet confirmed by the server, per room round. */
  pending: Record<Key, Record<string, AnswerValue>>;
  add: (key: Key, questionId: string, value: AnswerValue) => void;
  confirm: (key: Key, sent: Record<string, AnswerValue>) => void;
  clear: (key: Key) => void;
};

/**
 * Offline-first answers (spec section 8): taps land here first, then PUT /answers. Anything the
 * server has not confirmed survives a refresh in sessionStorage and is retried with backoff.
 */
export const useAnswerQueue = create<QueueState>()(
  persist(
    (set) => ({
      pending: {},
      add: (key, questionId, value) =>
        set((s) => ({
          pending: { ...s.pending, [key]: { ...s.pending[key], [questionId]: value } },
        })),
      confirm: (key, sent) =>
        set((s) => {
          const left = { ...s.pending[key] };
          for (const [id, value] of Object.entries(sent)) if (left[id] === value) delete left[id];
          return { pending: { ...s.pending, [key]: left } };
        }),
      clear: (key) =>
        set((s) => {
          const next = { ...s.pending };
          delete next[key];
          return { pending: next };
        }),
    }),
    {
      name: "spil-answer-queue",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];
