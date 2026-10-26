import type { Page, Route } from "@playwright/test";

/**
 * Every frame in design/SPIL Screens *.dc.html, with how to reach the same state in the app.
 * `go` runs on an app page already sized and themed like the frame.
 */
export type Frame = {
  set: "mobile" | "desktop";
  caption: string;
  slug: string;
  go: (page: Page) => Promise<void>;
};

const PUBLIC_ROOM = (pack: "classic" | "afterdark", status = "lobby", playerCount = 1) => ({
  code: "K7QX",
  status,
  pack:
    pack === "classic"
      ? { id: "classic", name: "Classic", icon: "cards", isAdult: false, heat: null }
      : { id: "afterdark", name: "After Dark", icon: "moon-stars", isAdult: true, heat: "spicy" },
  hostNickname: "Ama",
  hostAvatar: 4,
  playerCount,
  maxPlayers: 12,
  joined: false,
  minAge: pack === "classic" ? 13 : 18,
  ageLockHours: 24,
});

/** SPIL-02: the age screen comes first; frames after it start with an 18+ band on the device. */
const withAge = (page: Page) =>
  page.addInitScript(() =>
    localStorage.setItem("spil.age", JSON.stringify({ band: "18_plus", setAt: Date.now() })),
  );

/** Answers the public room lookup without touching the database, so join states are exact. */
async function mockRoom(page: Page, body: unknown, status = 200) {
  await page.route(/\/api\/v1\/rooms\/[A-Z0-9]{4}$/, (route: Route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

const settle = (page: Page) => page.waitForTimeout(900);

const fixture = (screen: string, variant = "") => async (page: Page) => {
  await page.goto(`/dev/screens/${screen}${variant ? `?variant=${variant}` : ""}`);
  await settle(page);
};

const joinError = (code: string, error: string, room?: unknown) => async (page: Page) => {
  if (room) await mockRoom(page, room);
  else await mockRoom(page, { error: { code: error, message: "" } }, error === "ROOM_EXPIRED" ? 410 : 404);
  // A full code submits by itself (SPIL-21).
  await page.goto(`/join?code=${code}`);
  await settle(page);
};

const profile = (pack: "classic" | "afterdark", error = false) => async (page: Page) => {
  await mockRoom(page, PUBLIC_ROOM(pack, "lobby", 0));
  await withAge(page);
  await page.goto("/r/K7QX/me");
  await page.getByLabel("Nickname").fill(error ? "A" : "Ama");
  await page.getByRole("radio", { name: pack === "afterdark" ? "Avatar: Clown" : "Avatar: Devil", exact: true }).click();
  if (error) await page.getByLabel("Nickname").press("Enter");
  await settle(page);
};

const route = (path: string) => async (page: Page) => {
  await page.goto(path);
  await settle(page);
};

const MOBILE: Array<[string, string, (page: Page) => Promise<void>]> = [
  ["Landing", "landing", route("/")],
  // "Landing, theme menu" is not compared: SPIL is dark only, with no theme menu.
  [
    "Join with code, typing",
    "join",
    async (page) => {
      await page.goto("/join");
      await page.getByLabel("Room code").fill("K7");
      await settle(page);
    },
  ],
  ["Join, invalid code", "join-invalid", joinError("Z9Z9", "ROOM_NOT_FOUND")],
  ["Join, expired", "join-expired", joinError("QLDX", "ROOM_EXPIRED")],
  ["Join, room full", "join-full", joinError("FULL", "", { ...PUBLIC_ROOM("classic", "lobby", 12) })],
  ["Join, already started", "join-started", joinError("LATE", "", { ...PUBLIC_ROOM("classic", "answering", 5) })],
  [
    "Pack picker",
    "packs",
    async (page) => {
      await withAge(page);
      await route("/create")(page);
    },
  ],
  ["Profile setup", "profile", profile("classic")],
  ["Profile, nickname error", "profile-error", profile("classic", true)],
  ["Profile, After Dark age check", "profile-spicy", profile("afterdark")],
  ["Lobby, empty (host alone)", "lobby-empty", fixture("lobby", "empty")],
  ["Lobby, Start disabled", "lobby-few", fixture("lobby", "few")],
  ["Lobby, host, full", "lobby", fixture("lobby")],
  ["Lobby, guest view", "lobby-guest", fixture("lobby", "guest")],
  ["Lobby, loading skeleton", "lobby-loading", fixture("lobby", "loading")],
  ["Question", "question", fixture("question")],
  ["Question, dragging Yes", "question-swipe", fixture("question", "swipe")],
  ["Question, saving", "question-saving", fixture("question", "saving")],
  ["Question, offline", "question-offline", fixture("question", "offline")],
  ["Waiting, host", "waiting", fixture("waiting")],
  ["Waiting, Force next sheet", "waiting-sheet", fixture("waiting", "sheet")],
  ["Waiting, guest", "waiting-guest", fixture("waiting", "guest")],
  ["Guess", "guess", fixture("guess")],
  ["Reveal ready", "ready", fixture("ready")],
  ["Reveal, counting", "reveal-count", fixture("reveal", "count")],
  ["Reveal, label slapped", "reveal-label", fixture("reveal", "label")],
  ["Reveal, award", "reveal-award", fixture("reveal", "award")],
  ["Results, scores", "results", fixture("results")],
  ["Results, awards", "results-awards", fixture("results", "awards")],
  ["Results, questions + Spill Mode", "results-questions", fixture("results", "questions")],
  ["Share sheet", "results-share", fixture("results", "share")],
  ["Error, room not found", "error-notfound", fixture("error", "notfound")],
  ["Error, expired", "error-expired", fixture("error", "expired")],
  ["Error, full", "error-full", fixture("error", "full")],
  ["Error, game started", "error-started", fixture("error", "started")],
  ["Error, offline", "error-offline", fixture("error", "offline")],
  ["Server waking up", "error-waking", fixture("error", "waking")],
  ["How to play", "page-howto", route("/how-to-play")],
  ["Privacy", "page-privacy", route("/privacy")],
  ["Terms", "page-terms", route("/terms")],
  ["Contact", "page-contact", route("/contact")],
];

const DESKTOP_CAPTIONS = new Map<string, string>([
  ["Landing", "landing"],
  ["Join, invalid", "join-invalid"],
  ["Pack picker", "packs"],
  ["Profile", "profile-spicy"],
  ["Lobby, host", "lobby"],
  ["Question", "question"],
  ["Waiting, Force next modal", "waiting-sheet"],
  ["Guess", "guess"],
  ["Reveal", "reveal-label"],
  ["Results", "results"],
  ["Share modal", "results-share"],
  ["Error, expired", "error-expired"],
  ["Privacy", "page-privacy"],
]);

const bySlug = new Map(MOBILE.map(([, slug, go]) => [slug, go]));

export const FRAMES: Frame[] = [
  ...MOBILE.map(([caption, slug, go]) => ({ set: "mobile" as const, caption, slug, go })),
  ...[...DESKTOP_CAPTIONS].map(([caption, slug]) => ({
    set: "desktop" as const,
    caption,
    slug,
    go: bySlug.get(slug)!,
  })),
];
