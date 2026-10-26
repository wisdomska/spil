/**
 * Admin API integration tests (docs/TECH_SPEC.md section 17) against a running app and its
 * Supabase project. Needs SUPABASE_SERVICE_ROLE_KEY as well as the usual API_BASE_URL, URL and
 * anon key; skipped otherwise. Test admins are throwaway users created with the service role and
 * deleted afterwards. Never calls the destructive reset-data endpoint as an owner.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonPlayer, BASE, code, enabled, type Player } from "./helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const d = enabled && SERVICE ? describe : describe.skip;

const service = () =>
  createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

type Role = "owner" | "content_lead" | "moderator";
type Admin = Player & { email: string; name: string };
const created: string[] = [];
const tag = randomBytes(3).toString("hex");

/** An admin backed by an anonymous auth user, so it works with or without the email provider. */
async function makeAdmin(role: Role): Promise<Admin> {
  const p = await anonPlayer();
  created.push(p.userId);
  const email = `it-${role}-${tag}-${randomBytes(2).toString("hex")}@example.com`;
  const name = `IT ${role} ${tag}`;
  const { error } = await service().from("admins").insert({ user_id: p.userId, email, name, role });
  if (error) throw new Error(`admins insert: ${error.message}`);
  return { ...p, email, name };
}

const raw = (path: string, init?: RequestInit) => fetch(`${BASE}/api/v1${path}`, init);

let owner: Admin;
let lead: Admin;
let mod: Admin;
let player: Player;
let packId = "";

beforeAll(async () => {
  if (!(enabled && SERVICE)) return;
  [owner, lead, mod, player] = await Promise.all([
    makeAdmin("owner"),
    makeAdmin("content_lead"),
    makeAdmin("moderator"),
    anonPlayer(),
  ]);
  created.push(player.userId);
});

afterAll(async () => {
  if (!(enabled && SERVICE)) return;
  const db = service();
  if (packId) await db.from("packs").delete().eq("id", packId);
  for (const id of created) await db.auth.admin.deleteUser(id);
});

d("admin access", () => {
  it("is 401 without a session", async () => {
    const res = await raw("/admin/counts");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("is 403 for a signed-in player who is not an admin", async () => {
    const res = await player.call("GET", "/admin/counts");
    expect(res.status).toBe(403);
    expect(code(res)).toBe("FORBIDDEN");
  });

  it("lets every role read the overview, audit log and own account", async () => {
    for (const a of [owner, lead, mod]) {
      for (const path of ["/admin/overview", "/admin/audit", "/admin/me", "/admin/counts"]) {
        const res = await a.call("GET", path);
        expect(res.status, `${a.name} ${path}`).toBe(200);
      }
    }
    const me = await mod.call("GET", "/admin/me");
    expect(me.body).toMatchObject({ role: "moderator", name: mod.name });
    const overview = await owner.call("GET", "/admin/overview");
    expect(overview.body.days).toHaveLength(30);
    expect(Array.isArray(overview.body.packPlays)).toBe(true);
  });

  it("pages the long lists on the server, with filters and a total", async () => {
    for (const path of ["/admin/rooms", "/admin/reports", "/admin/messages", "/admin/audit"]) {
      const first = await owner.call("GET", `${path}?page=1&size=10`);
      expect(first.status, path).toBe(200);
      expect(first.body).toMatchObject({ page: 1, size: 10 });
      expect(first.body.rows.length, path).toBeLessThanOrEqual(10);
      expect(first.body.total, path).toBeGreaterThanOrEqual(first.body.rows.length);
      if (first.body.total > 10) {
        const second = await owner.call("GET", `${path}?page=2&size=10`);
        const ids = new Set(first.body.rows.map((r: { id: string }) => r.id));
        expect(
          second.body.rows.some((r: { id: string }) => ids.has(r.id)),
          path,
        ).toBe(false);
      }
    }
    // An unknown size falls back to the default; filters narrow the total.
    expect((await owner.call("GET", "/admin/rooms?page=1&size=37")).body.size).toBe(20);
    const closed = await owner.call("GET", "/admin/rooms?page=1&size=100&status=closed");
    expect(closed.body.rows.every((r: { status: string }) => r.status === "closed")).toBe(true);
    const open = await owner.call("GET", "/admin/reports?page=1&size=100&status=open");
    expect(open.body.rows.every((r: { status: string }) => r.status === "open")).toBe(true);
    const search = await owner.call("GET", "/admin/audit?page=1&size=10&q=signed,(in)");
    expect(search.status).toBe(200);
    // Without `page` the lists keep their old shape.
    expect(Array.isArray((await owner.call("GET", "/admin/rooms")).body)).toBe(true);
  });

  it("leaves a room's own custom questions out of the managed lists", async () => {
    const list = await owner.call("GET", "/admin/questions");
    expect(list.body.some((q: { packId: string }) => q.packId.startsWith("custom_"))).toBe(false);
  });

  it("applies the role matrix", async () => {
    const expectStatus = async (
      a: Admin,
      method: string,
      path: string,
      status: number,
      body?: unknown,
    ) => {
      const res = await a.call(method, path, body);
      expect(res.status, `${a.name} ${method} ${path} ${JSON.stringify(res.body)}`).toBe(status);
    };
    await expectStatus(lead, "GET", "/admin/rooms", 403);
    await expectStatus(lead, "GET", "/admin/reports", 403);
    await expectStatus(lead, "GET", "/admin/messages", 403);
    await expectStatus(lead, "GET", "/admin/admins", 403);
    await expectStatus(lead, "PATCH", "/admin/flags", 403, { key: "party_mode", enabled: false });
    await expectStatus(mod, "GET", "/admin/rooms", 200);
    await expectStatus(mod, "GET", "/admin/reports", 200);
    await expectStatus(mod, "GET", "/admin/messages", 200);
    await expectStatus(mod, "GET", "/admin/questions", 200);
    await expectStatus(mod, "POST", "/admin/packs", 403, {});
    await expectStatus(mod, "POST", "/admin/questions/import", 403, { csv: "x" });
    await expectStatus(mod, "PATCH", "/admin/settings", 403, {});
    await expectStatus(mod, "POST", "/admin/reset-data", 403);
    await expectStatus(lead, "POST", "/admin/reset-data", 403);
    await expectStatus(owner, "GET", "/admin/admins", 200);
  });
});

d("admin content", () => {
  let questionId = "";

  it("creates a pack (never straight to live) and audits it", async () => {
    const body = {
      name: `IT Pack ${tag}`,
      blurb: "Integration test pack.",
      icon: "cards",
      tone: "raised",
      minAge: 13,
      section: "everyday",
      spice: 2,
      region: null,
      status: "draft",
      sortOrder: 999,
    };
    expect(code(await lead.call("POST", "/admin/packs", { ...body, status: "live" }))).toBe(
      "PACK_NOT_READY",
    );
    expect(code(await lead.call("POST", "/admin/packs", { ...body, icon: "not-an-icon" }))).toBe(
      "BAD_REQUEST",
    );
    const res = await lead.call("POST", "/admin/packs", body);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    packId = res.body.id;
    expect(packId).toMatch(/^it_pack_[a-z0-9_]+$/);
    expect(code(await lead.call("POST", "/admin/packs", body))).toBe("DUPLICATE");
    const audit = await lead.call("GET", "/admin/audit");
    expect(audit.body[0]).toMatchObject({ who: lead.name, action: "pack_created" });
  });

  it("adds questions, strips Have you ever and skips duplicates", async () => {
    const res = await lead.call("POST", "/admin/questions", {
      packId,
      status: "live",
      texts: ["Have you ever tested in production", "written a test that always passes?"],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual({ added: 2, duplicates: 0 });
    expect(
      code(
        await lead.call("POST", "/admin/questions", {
          packId,
          status: "live",
          texts: ["tested in production?"],
        }),
      ),
    ).toBe("DUPLICATE");
    expect(
      code(await lead.call("POST", "/admin/questions", { packId, status: "live", texts: ["hi"] })),
    ).toBe("QUESTION_INVALID");
    const all = await lead.call("GET", "/admin/questions");
    const mine = all.body.filter((q: { packId: string }) => q.packId === packId);
    expect(mine.map((q: { text: string }) => q.text).sort()).toEqual([
      "tested in production?",
      "written a test that always passes?",
    ]);
    questionId = mine[0].id;
  });

  it("publishes the pack once it has a live question", async () => {
    const packs = await lead.call("GET", "/admin/packs");
    const pack = packs.body.find((p: { id: string }) => p.id === packId);
    expect(pack).toMatchObject({ liveQuestions: 2, totalQuestions: 2, status: "draft" });
    const res = await lead.call("PATCH", `/admin/packs/${packId}`, {
      name: pack.name,
      blurb: pack.blurb,
      icon: "fire",
      tone: "accent",
      minAge: 18,
      section: "after_dark",
      spice: 4,
      region: "gh",
      status: "hidden",
      sortOrder: 998,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = (await lead.call("GET", "/admin/packs")).body.find(
      (p: { id: string }) => p.id === packId,
    );
    expect(after).toMatchObject({
      icon: "fire",
      minAge: 18,
      section: "after_dark",
      spice: 4,
      region: "GH",
    });
  });

  it("lets moderators hide but nothing else", async () => {
    expect(
      code(await mod.call("PATCH", `/admin/questions/${questionId}`, { status: "live" })),
    ).toBe("FORBIDDEN");
    expect(
      code(
        await mod.call("PATCH", `/admin/questions/${questionId}`, {
          status: "hidden",
          text: "changed by a moderator?",
        }),
      ),
    ).toBe("FORBIDDEN");
    const ok = await mod.call("PATCH", `/admin/questions/${questionId}`, { status: "hidden" });
    expect(ok.status).toBe(200);
    const audit = await mod.call("GET", "/admin/audit");
    expect(audit.body[0]).toMatchObject({ who: mod.name, action: "question_hidden" });
    expect(code(await mod.call("DELETE", `/admin/questions/${questionId}`))).toBe("FORBIDDEN");
  });

  it("edits a question and shows it again", async () => {
    const res = await lead.call("PATCH", `/admin/questions/${questionId}`, {
      text: "Have you ever deployed on a Friday",
      status: "live",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const q = (await lead.call("GET", "/admin/questions")).body.find(
      (x: { id: string }) => x.id === questionId,
    );
    expect(q).toMatchObject({ text: "deployed on a Friday?", status: "live" });
  });

  it("imports CSV, reports bad rows and round-trips the export", async () => {
    const bad = await lead.call("POST", "/admin/questions/import", {
      csv: `pack,question\n${packId},renamed a variable to x\nnope,lost my keys at a party`,
    });
    expect(bad.body).toEqual({
      added: 0,
      duplicates: 0,
      errors: [{ line: 3, error: "unknown_pack" }],
    });
    const good = await lead.call("POST", "/admin/questions/import", {
      csv: `pack_id,question,status\n${packId},"renamed a variable to ""x""",draft\n${packId},deployed on a Friday?,live`,
    });
    expect(good.body).toEqual({ added: 1, duplicates: 1, errors: [] });

    const res = await fetch(`${BASE}/api/v1/admin/questions/export?pack=${packId}`, {
      headers: { authorization: `Bearer ${lead.token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toBe(
      "pack_id,pack,question,status,is_sample,min_age,section,spice,answered,yes_rate,reports",
    );
    expect(csv).toContain('Have you ever renamed a variable to ""x""?');
    const again = await lead.call("POST", "/admin/questions/import", { csv });
    expect(again.body).toEqual({ added: 0, duplicates: 3, errors: [] });
  });

  it("deletes a question and a pack, but never a pack that rooms still use", async () => {
    const del = await lead.call("DELETE", `/admin/questions/${questionId}`);
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    expect(code(await lead.call("DELETE", `/admin/questions/${questionId}`))).toBe("NOT_FOUND");
    const delPack = await lead.call("DELETE", `/admin/packs/${packId}`);
    expect(delPack.status, JSON.stringify(delPack.body)).toBe(200);
    packId = "";
    // Classic always has rooms in CI and staging (the game tests create them).
    const room = await player.call("POST", "/rooms", { ageBand: "18_plus", packId: "classic" });
    expect(room.status).toBe(200);
    expect(code(await owner.call("DELETE", "/admin/packs/classic"))).toBe("PACK_IN_USE");
  });
});

d("admin moderation", () => {
  it("closes a room", async () => {
    const created = await player.call("POST", "/rooms", { ageBand: "18_plus", packId: "classic" });
    const roomCode: string = created.body.code;
    await player.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Closer",
      avatar: 1,
    });
    const rooms = await mod.call("GET", "/admin/rooms");
    const room = rooms.body.find((r: { code: string; status: string }) => r.code === roomCode);
    expect(room).toMatchObject({ status: "lobby", players: 1, hostNickname: "Closer" });
    expect(code(await lead.call("POST", `/admin/rooms/${room.id}/close`))).toBe("FORBIDDEN");
    const res = await mod.call("POST", `/admin/rooms/${room.id}/close`);
    expect(res.status).toBe(200);
    const preview = await player.call("GET", `/rooms/${roomCode}`);
    expect(preview.status).toBeGreaterThanOrEqual(400);
  });

  it("dismisses a report and removes a reported player", async () => {
    const host = await anonPlayer();
    const guest = await anonPlayer();
    created.push(host.userId, guest.userId);
    const room = await host.call("POST", "/rooms", { ageBand: "18_plus", packId: "classic" });
    const roomCode: string = room.body.code;
    await host.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Host",
      avatar: 2,
    });
    const joined = await guest.call("POST", `/rooms/${roomCode}/join`, {
      ageBand: "18_plus",
      nickname: "Rude Name",
      avatar: 3,
    });
    const guestId: string = joined.body.playerId;
    for (const reason of [`spam ${tag}`, `rude ${tag}`]) {
      const r = await host.call("POST", "/reports", {
        type: "nickname",
        playerId: guestId,
        roomCode,
        reason,
      });
      expect(r.status).toBe(200);
    }
    const list = await mod.call("GET", "/admin/reports");
    const mine = list.body.filter((r: { reason: string }) => r.reason.endsWith(tag));
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({ status: "open", roomCode, playerNickname: "Rude Name" });

    const dismiss = await mod.call("POST", `/admin/reports/${mine[0].id}`, { action: "dismiss" });
    expect(dismiss.status).toBe(200);
    expect(
      code(await mod.call("POST", `/admin/reports/${mine[1].id}`, { action: "hide_question" })),
    ).toBe("BAD_REQUEST");
    const remove = await mod.call("POST", `/admin/reports/${mine[1].id}`, {
      action: "remove_player",
    });
    expect(remove.status, JSON.stringify(remove.body)).toBe(200);
    const after = (await mod.call("GET", "/admin/reports")).body.filter((r: { reason: string }) =>
      r.reason.endsWith(tag),
    );
    expect(after.map((r: { status: string }) => r.status).sort()).toEqual([
      "actioned",
      "dismissed",
    ]);
    const state = await guest.call("GET", `/rooms/${roomCode}/state`);
    expect(code(state)).toBe("NOT_IN_ROOM");
  });

  it("marks messages read and archives them", async () => {
    const text = `Integration inbox ${tag}`;
    await fetch(`${BASE}/api/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `10.1.${tag.length}.7` },
      body: JSON.stringify({ body: text }),
    });
    const list = await mod.call("GET", "/admin/messages");
    const msg = list.body.find((m: { body: string }) => m.body === text);
    expect(msg).toMatchObject({ status: "new" });
    expect((await mod.call("PATCH", `/admin/messages/${msg.id}`, { status: "read" })).status).toBe(
      200,
    );
    expect(
      (await mod.call("PATCH", `/admin/messages/${msg.id}`, { status: "archived" })).status,
    ).toBe(200);
    const after = (await mod.call("GET", "/admin/messages")).body.find(
      (m: { id: string }) => m.id === msg.id,
    );
    expect(after.status).toBe("archived");
  });
});

d("admin settings and accounts", () => {
  it("validates and saves settings (writing the same values back)", async () => {
    const current = await owner.call("GET", "/admin/settings");
    expect(current.body.flags).toHaveProperty("polling_only");
    const s = current.body.settings;
    expect(
      code(await owner.call("PATCH", "/admin/settings", { ...s, minPlayers: 10, maxPlayers: 5 })),
    ).toBe("BAD_REQUEST");
    const res = await owner.call("PATCH", "/admin/settings", s);
    expect(res.status).toBe(200);
    const flag = current.body.flags.party_mode ?? false;
    const f = await owner.call("PATCH", "/admin/flags", { key: "party_mode", enabled: flag });
    expect(f.status).toBe(200);
    const audit = await owner.call("GET", "/admin/audit");
    expect(audit.body.slice(0, 2).map((a: { action: string }) => a.action)).toEqual([
      "flag_changed",
      "settings_changed",
    ]);
  });

  it("adds an admin, changes the role, resets the password and removes them", async () => {
    const email = `it-new-${tag}@example.com`;
    expect(
      code(
        await owner.call("POST", "/admin/admins", {
          name: "New",
          email,
          password: "short",
          role: "moderator",
        }),
      ),
    ).toBe("BAD_REQUEST");
    const add = await owner.call("POST", "/admin/admins", {
      name: "New Admin",
      email,
      password: randomBytes(12).toString("base64url"),
      role: "moderator",
    });
    expect(add.status, JSON.stringify(add.body)).toBe(200);
    const id: string = add.body.userId;
    created.push(id);
    expect(
      code(
        await owner.call("POST", "/admin/admins", {
          name: "Again",
          email,
          password: randomBytes(12).toString("base64url"),
          role: "moderator",
        }),
      ),
    ).toBe("EMAIL_TAKEN");
    expect(
      (await owner.call("PATCH", `/admin/admins/${id}`, { role: "content_lead" })).status,
    ).toBe(200);
    const reset = await owner.call("POST", `/admin/admins/${id}/reset-password`);
    expect(reset.status).toBe(200);
    expect(reset.body.password).toMatch(/^[A-Za-z0-9]{16}$/);
    expect((await owner.call("DELETE", `/admin/admins/${id}`)).status).toBe(200);
    const list = await owner.call("GET", "/admin/admins");
    expect(list.body.some((a: { userId: string }) => a.userId === id)).toBe(false);
  });

  it("never lets an owner change or remove themselves", async () => {
    expect(code(await owner.call("DELETE", `/admin/admins/${owner.userId}`))).toBe(
      "CANNOT_CHANGE_SELF",
    );
    expect(
      code(await owner.call("PATCH", `/admin/admins/${owner.userId}`, { role: "moderator" })),
    ).toBe("CANNOT_CHANGE_SELF");
    expect(code(await owner.call("POST", `/admin/admins/${owner.userId}/reset-password`))).toBe(
      "CANNOT_CHANGE_SELF",
    );
  });
});

d("admin sign-in", () => {
  it("rate limits sign-in to 5 tries per 15 minutes per IP", async () => {
    const ip = `10.${(parseInt(tag, 16) % 200) + 20}.3.9`;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await raw("/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ email: `nobody-${tag}@example.com`, password: "wrong-password" }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it("signs an admin in with a password and sets the session cookie", async (ctx) => {
    const email = `it-login-${tag}@example.com`;
    const password = randomBytes(12).toString("base64url");
    const db = service();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message);
    created.push(data.user.id);
    await db
      .from("admins")
      .insert({ user_id: data.user.id, email, name: "Login IT", role: "moderator" });
    // Projects with the email provider switched off cannot do password sign-in at all.
    const probe = await createClient(SUPABASE_URL, ANON, {
      auth: { persistSession: false },
    }).auth.signInWithPassword({ email, password });
    if (probe.error?.code === "email_provider_disabled") return ctx.skip();

    const res = await raw("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `10.250.${tag.length}.1` },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).me).toMatchObject({ email, role: "moderator" });
    expect(res.headers.get("set-cookie")).toMatch(/sb-.*-auth-token/);

    // A real user who is not an admin gets the same answer as a wrong password.
    await db.from("admins").delete().eq("user_id", data.user.id);
    const denied = await raw("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `10.251.${tag.length}.1` },
      body: JSON.stringify({ email, password }),
    });
    expect(denied.status).toBe(401);
    expect((await denied.json()).error.code).toBe("INVALID_CREDENTIALS");
  });
});

d("Party Mode (Batch 2)", () => {
  it("pairs a big screen with a secret link; the screen never sees anyone's own play", async () => {
    const before = (await owner.call("GET", "/admin/settings")).body.flags.party_mode ?? false;
    const host = await anonPlayer();
    const guest = await anonPlayer();
    const created = await host.call("POST", "/rooms", {
      ageBand: "18_plus",
      packId: "classic",
      questionCount: 5,
    });
    const roomCode: string = created.body.code;
    for (const [i, p] of [host, guest].entries())
      await p.call("POST", `/rooms/${roomCode}/join`, {
        ageBand: "18_plus",
        nickname: `TV ${i}`,
        avatar: i,
      });
    const screen = (token: string) => fetch(`${BASE}/api/v1/rooms/${roomCode}/tv?t=${token}`);
    try {
      await owner.call("PATCH", "/admin/flags", { key: "party_mode", enabled: false });
      expect(code(await host.call("POST", `/rooms/${roomCode}/tv`))).toBe("FEATURE_OFF");

      await owner.call("PATCH", "/admin/flags", { key: "party_mode", enabled: true });
      const lobby = await host.call("GET", `/rooms/${roomCode}/state`);
      expect(lobby.body.room.partyMode).toBe(true);
      expect(code(await guest.call("POST", `/rooms/${roomCode}/tv`))).toBe("NOT_HOST");
      const paired = await host.call("POST", `/rooms/${roomCode}/tv`);
      const token: string = paired.body.token;
      expect(token.length).toBeGreaterThanOrEqual(24);
      // Pairing again returns the same link.
      expect((await host.call("POST", `/rooms/${roomCode}/tv`)).body.token).toBe(token);

      expect((await screen("x".repeat(32))).status).toBe(403);
      const view = await (await screen(token)).json();
      expect(view.room.code).toBe(roomCode);
      expect(view.players).toHaveLength(2);
      expect(view.joinPath).toBe(`/r/${roomCode}/me`);
      expect(view).not.toHaveProperty("me");

      // While answering, the screen shows progress but never answers.
      await host.call("POST", `/rooms/${roomCode}/start`);
      const state = await host.call("GET", `/rooms/${roomCode}/state`);
      await host.call("PUT", `/rooms/${roomCode}/answers`, {
        answers: state.body.questions.map((q: { id: string }) => ({
          questionId: q.id,
          value: "yes",
        })),
      });
      const answering = await (await screen(token)).json();
      expect(answering.room.status).toBe("answering");
      expect(JSON.stringify(answering)).not.toContain('"yes"');
      expect(answering).not.toHaveProperty("questions");
      expect(answering).not.toHaveProperty("myAnswers");
    } finally {
      await owner.call("PATCH", "/admin/flags", { key: "party_mode", enabled: before });
    }
  });
});

d("Premium packs (Batch 3)", () => {
  it("are free while payments are off, and marked and locked while they are on", async () => {
    const settings = (await owner.call("GET", "/admin/settings")).body.flags;
    const paymentsBefore = settings.payments_enabled ?? false;
    const packs = (await owner.call("GET", "/admin/packs")).body as Array<
      Record<string, unknown> & { id: string }
    >;
    const campus = packs.find((p) => p.id === "campus")!;
    const body = {
      name: campus.name,
      blurb: campus.blurb,
      icon: campus.icon,
      tone: campus.tone,
      minAge: campus.minAge,
      section: campus.section,
      spice: campus.spice,
      region: campus.region,
      status: campus.status,
      sortOrder: campus.sortOrder,
    };
    const player = await anonPlayer();
    const listed = async () =>
      (
        (await player.call("GET", "/packs?band=18_plus")).body as Array<{
          id: string;
          locked: boolean;
        }>
      ).find((p) => p.id === "campus")!;
    try {
      expect(
        (await owner.call("PATCH", "/admin/packs/campus", { ...body, premium: true })).status,
      ).toBe(200);
      await owner.call("PATCH", "/admin/flags", { key: "payments_enabled", enabled: false });
      expect((await listed()).locked).toBe(false);

      await owner.call("PATCH", "/admin/flags", { key: "payments_enabled", enabled: true });
      expect((await listed()).locked).toBe(true);
      const room = await player.call("POST", "/rooms", { ageBand: "18_plus", packId: "campus" });
      expect(code(room)).toBe("PACK_PREMIUM");
    } finally {
      await owner.call("PATCH", "/admin/flags", {
        key: "payments_enabled",
        enabled: paymentsBefore,
      });
      await owner.call("PATCH", "/admin/packs/campus", { ...body, premium: false });
    }
  });
});
