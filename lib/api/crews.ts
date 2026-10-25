import "server-only";
import { randomBytes } from "node:crypto";
import {
  MAX_CREW_MEMBERS,
  MAX_CREW_NAME,
  seasonKey,
  seasonTable,
  type CrewRound,
  type CrewRoundScore,
  type SeasonRow,
} from "@/lib/game";
import { filterText } from "@/lib/moderation/filter";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";

const db = () => getAdminClient();

export type CrewSummary = { id: string; name: string; members: number };

export type CrewDetail = {
  id: string;
  name: string;
  inviteToken: string;
  members: Array<{ userId: string; nickname: string; you: boolean }>;
  season: string;
  /** This month, so the page knows how far forward it can go. */
  currentSeason: string;
  /** Seasons with rounds, newest first. */
  seasons: string[];
  table: SeasonRow[];
  rounds: Array<{
    roomCode: string;
    round: number;
    mode: string;
    playedAt: string;
    winner: string | null;
  }>;
};

/** A crew name: filtered like any player text, and short. */
export function cleanCrewName(input: string): string {
  const result = filterText(input);
  if (!result.ok)
    throw new ApiError(
      result.reason === "blocked"
        ? "TEXT_BLOCKED"
        : result.reason === "contact"
          ? "TEXT_CONTACT"
          : "TEXT_EMPTY",
    );
  if (result.text.length > MAX_CREW_NAME)
    throw new ApiError("BAD_REQUEST", "Keep the name to 40 characters.");
  return result.text;
}

async function requireCrewMember(crewId: string, userId: string) {
  const { data, error } = await db()
    .from("crew_members")
    .select("user_id")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("NOT_FOUND");
}

export async function isCrewMember(crewId: string, userId: string) {
  const { data } = await db()
    .from("crew_members")
    .select("user_id")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function crewName(crewId: string) {
  const { data } = await db().from("crews").select("name").eq("id", crewId).maybeSingle();
  return data?.name ?? null;
}

/** Saves a group as a crew: only the person saving it joins; the others join by choice. */
export async function createCrew(userId: string, nickname: string, name: string) {
  const token = randomBytes(18).toString("base64url");
  const { data, error } = await db()
    .from("crews")
    .insert({ name: cleanCrewName(name), invite_token: token, created_by: userId })
    .select("id")
    .single();
  if (error) throw fromDbError(error);
  const { error: memberError } = await db()
    .from("crew_members")
    .insert({ crew_id: data.id, user_id: userId, nickname });
  if (memberError) throw fromDbError(memberError);
  return { id: data.id, token };
}

/** Adds a member, by choice. Refuses a full crew. Joining twice keeps the first membership. */
export async function addMember(crewId: string, userId: string, nickname: string) {
  const { count, error } = await db()
    .from("crew_members")
    .select("user_id", { count: "exact", head: true })
    .eq("crew_id", crewId);
  if (error) throw fromDbError(error);
  if ((count ?? 0) >= MAX_CREW_MEMBERS && !(await isCrewMember(crewId, userId)))
    throw new ApiError("ROOM_FULL", "This crew is full.");
  const { error: upsertError } = await db()
    .from("crew_members")
    .upsert(
      { crew_id: crewId, user_id: userId, nickname },
      { onConflict: "crew_id,user_id", ignoreDuplicates: true },
    );
  if (upsertError) throw fromDbError(upsertError);
}

export async function crewByToken(token: string) {
  const { data, error } = await db()
    .from("crews")
    .select("id, name")
    .eq("invite_token", token)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("NOT_FOUND");
  const { count } = await db()
    .from("crew_members")
    .select("user_id", { count: "exact", head: true })
    .eq("crew_id", data.id);
  return { id: data.id, name: data.name, members: count ?? 0 };
}

export async function leaveCrew(crewId: string, userId: string) {
  await requireCrewMember(crewId, userId);
  const { error } = await db()
    .from("crew_members")
    .delete()
    .eq("crew_id", crewId)
    .eq("user_id", userId);
  if (error) throw fromDbError(error);
}

export async function myCrews(userId: string): Promise<CrewSummary[]> {
  const { data, error } = await db().from("crew_members").select("crew_id").eq("user_id", userId);
  if (error) throw fromDbError(error);
  const ids = (data ?? []).map((m) => m.crew_id);
  if (!ids.length) return [];
  const [crews, members] = await Promise.all([
    db().from("crews").select("id, name").in("id", ids).order("created_at", { ascending: false }),
    db().from("crew_members").select("crew_id").in("crew_id", ids),
  ]);
  if (crews.error) throw fromDbError(crews.error);
  const counts = new Map<string, number>();
  for (const m of members.data ?? []) counts.set(m.crew_id, (counts.get(m.crew_id) ?? 0) + 1);
  return (crews.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    members: counts.get(c.id) ?? 0,
  }));
}

export async function crewDetail(
  crewId: string,
  userId: string,
  season?: string,
): Promise<CrewDetail> {
  await requireCrewMember(crewId, userId);
  const [crew, members, rounds] = await Promise.all([
    db().from("crews").select("id, name, invite_token").eq("id", crewId).single(),
    db().from("crew_members").select("user_id, nickname").eq("crew_id", crewId).order("joined_at"),
    db()
      .from("crew_rounds")
      .select("room_code, round, mode, played_at, scores")
      .eq("crew_id", crewId)
      .order("played_at", { ascending: false })
      .limit(500),
  ]);
  if (crew.error) throw fromDbError(crew.error);
  if (members.error) throw fromDbError(members.error);
  if (rounds.error) throw fromDbError(rounds.error);
  const memberIds = new Set((members.data ?? []).map((m) => m.user_id));
  const all: Array<CrewRound & { roomCode: string; round: number; mode: string }> = (
    rounds.data ?? []
  ).map((r) => ({
    roomCode: r.room_code,
    round: r.round,
    mode: r.mode,
    playedAt: r.played_at,
    scores: (r.scores as unknown as CrewRoundScore[]) ?? [],
  }));
  const seasons = [...new Set(all.map((r) => seasonKey(r.playedAt)))];
  const current = season && /^\d{4}-\d{2}$/.test(season) ? season : seasonKey(Date.now());
  return {
    id: crew.data.id,
    name: crew.data.name,
    inviteToken: crew.data.invite_token,
    members: (members.data ?? []).map((m) => ({
      userId: m.user_id,
      nickname: m.nickname,
      you: m.user_id === userId,
    })),
    season: current,
    currentSeason: seasonKey(Date.now()),
    seasons,
    table: seasonTable(all, memberIds, current),
    rounds: all.slice(0, 20).map((r) => ({
      roomCode: r.roomCode,
      round: r.round,
      mode: r.mode,
      playedAt: r.playedAt,
      // Only a member's name is shown in the history.
      winner: r.scores.find((s) => s.rank === 1 && memberIds.has(s.userId))?.nickname ?? null,
    })),
  };
}

/** Keeps a round played as a crew: nicknames, Mind Reader points and ranks only. */
export async function recordCrewRound(input: {
  crewId: string;
  roomCode: string;
  round: number;
  mode: string;
  scores: CrewRoundScore[];
}) {
  const { error } = await db()
    .from("crew_rounds")
    .upsert(
      {
        crew_id: input.crewId,
        room_code: input.roomCode,
        round: input.round,
        mode: input.mode,
        scores: input.scores.map((s) => ({
          userId: s.userId,
          nickname: s.nickname,
          points: s.points,
          rank: s.rank,
        })),
      },
      { onConflict: "crew_id,room_code,round" },
    );
  if (error) throw fromDbError(error);
}
