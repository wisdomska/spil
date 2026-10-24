// Design fixtures (design/SPIL App.dc.html ROSTER, QS, AWARDS) for the dev-only screens route and
// the visual parity suite. Never imported by production pages.
import type { AwardRow, ResultRow, RoomState, StatePlayer } from "@/lib/api/types";
import type { AwardId, LabelId, RoomStatus } from "@/lib/game";
import { labelFor } from "@/lib/game";

export const ROSTER = [
  { id: "ama", name: "Ama", av: 0, score: 72, guess: 64, mr: 34 },
  { id: "kofi", name: "Kofi", av: 5, score: 41, guess: 55, mr: 18 },
  { id: "zainab", name: "Zainab", av: 9, score: 18, guess: 27, mr: 41 },
  { id: "tunde", name: "Tunde", av: 14, score: 88, guess: 71, mr: 29 },
  { id: "efua", name: "Efua", av: 3, score: 9, guess: 20, mr: 25 },
  { id: "chidi", name: "Chidi", av: 18, score: 57, guess: 31, mr: 22 },
  { id: "yaw", name: "Yaw", av: 21, score: 33, guess: 30, mr: 15 },
] as const;

export const QS = [
  'lied that you were "on your way" while still in bed?',
  "checked an ex's new partner's profile at 2am?",
  "gone to a party you weren't invited to?",
  "pretended your data finished to dodge a call?",
  "eaten someone else's food from the shared fridge?",
  "cried at a Nollywood movie?",
  "sent a voice note you instantly regretted?",
  'borrowed money and "forgot" to pay it back?',
  "sneaked out of your parents' house at night?",
  "read someone's messages over their shoulder?",
  "regifted a present?",
  "laughed at a joke you didn't understand?",
];

const AWARDS: Array<[AwardId, string, string]> = [
  ["top_spiller", "tunde", "Highest score in the room. 88 out of 100."],
  ["saint_of_the_room", "efua", "Scored 9. Either a saint or a very good liar."],
  ["mind_reader", "zainab", "Most Mind Reader points in the room: 41."],
  ["dark_horse", "chidi", "The room guessed 31. Chidi scored 57."],
  ["open_book", "ama", "The room guessed 64. Ama scored 72. Close enough."],
  ["clueless", "kofi", "Furthest guesses in the room. Kofi, really?"],
];

type Opts = {
  status: RoomStatus;
  players?: number;
  host?: boolean;
  answered?: number;
  pack?: { id: string; name: string; adult?: boolean };
};

/** A RoomState as Ama sees it (you are Ama; Ama hosts unless host is false). */
export function fixtureState({
  status,
  players = 7,
  host = true,
  answered = 11,
  total = 50,
  pack,
  guessed = 1,
}: Opts & { total?: number; guessed?: number }): RoomState {
  const roster = ROSTER.slice(0, players);
  const hostId = host ? "ama" : "tunde";
  const done = new Set(["ama", "zainab", "tunde", "efua", "chidi"]);
  const statePlayers: StatePlayer[] = roster.map((p, i) => ({
    id: p.id,
    nickname: p.name,
    avatar: p.av,
    rotationSeed: i,
    isHost: p.id === hostId,
    isBot: false,
    status: "active",
    answered: done.has(p.id) ? 12 : p.id === "kofi" ? 7 : 9,
    lastAnswerAt:
      status === "answering" && !done.has(p.id)
        ? new Date(Date.now() - (p.id === "kofi" ? 42_000 : 12_000)).toISOString()
        : undefined,
    answersSubmitted: status !== "answering" || done.has(p.id),
    guessesSubmitted:
      status === "ready" || status === "revealed" || (status === "guessing" && done.has(p.id)),
  }));
  const me = statePlayers.find((p) => p.id === "ama")!;
  const rows: ResultRow[] = [...roster]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      playerId: p.id,
      nickname: p.name,
      avatar: p.av,
      score: p.score,
      label: labelFor(p.score).id as LabelId,
      avgGuessAbout: p.guess,
      mindReader: p.mr,
      bullseyes: p.id === "zainab" ? 2 : 0,
      rank: i + 1,
    }));
  const awards: AwardRow[] = AWARDS.map(([award, playerId, reason], i) => ({
    award,
    playerId,
    reason,
    position: i + 1,
  }));
  const qids = Array.from(
    { length: total },
    (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  );
  const qtext = (i: number) => QS[i % QS.length]!;

  return {
    room: {
      code: "K7QX",
      status,
      round: 1,
      pack: {
        id: pack?.id ?? "classic",
        name: pack?.name ?? "Classic",
        icon: "cards",
        isAdult: pack?.adult ?? false,
        minAge: pack?.adult ? 18 : 13,
        heat: pack?.adult ? "spicy" : null,
      },
      questionCount: total,
      revealedAt: undefined,
      settings: { minPlayers: 3, maxPlayers: 12 },
      testPlayers: true,
      pollingOnly: false,
      channel: "room:fixture",
    },
    me: {
      id: "ama",
      nickname: "Ama",
      avatar: 0,
      isHost: me.isHost,
      status: "active",
      answersSubmitted: me.answersSubmitted,
      guessesSubmitted: me.guessesSubmitted,
      spillMode: false,
      hideNameOnCard: false,
      targets:
        status === "guessing" ? statePlayers.filter((p) => p.id !== "ama").map((p) => p.id) : [],
    },
    players: statePlayers,
    questions: status === "answering" ? qids.map((id, i) => ({ id, text: qtext(i) })) : undefined,
    myAnswers:
      status === "answering"
        ? Object.fromEntries(
            qids.slice(0, answered).map((id, i) => [id, i % 2 ? "no" : "yes"] as const),
          )
        : undefined,
    myGuesses:
      status === "guessing"
        ? Object.fromEntries(
            statePlayers
              .filter((p) => p.id !== "ama")
              .slice(0, guessed)
              .map((p) => [p.id, 50]),
          )
        : undefined,
    results:
      status === "revealed"
        ? {
            rows,
            // Zainab read Tunde and Kofi exactly.
            exact: [
              { guesserId: "zainab", targetId: "tunde" },
              { guesserId: "zainab", targetId: "kofi" },
            ],
            awards,
            questionStats: [
              { questionId: qids[5]!, text: QS[5]!, yes: 5, answered: 7, spillNames: ["Tunde"] },
              {
                questionId: qids[0]!,
                text: QS[0]!,
                yes: 6,
                answered: 7,
                spillNames: ["Tunde", "Ama"],
              },
              { questionId: qids[6]!, text: QS[6]!, yes: 3, answered: 6, spillNames: ["Ama"] },
              { questionId: qids[2]!, text: QS[2]!, yes: 2, answered: 7, spillNames: [] },
            ],
          }
        : undefined,
  };
}
