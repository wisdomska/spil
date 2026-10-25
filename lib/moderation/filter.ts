/**
 * Player-written text filter (owner decision 2026-10-24: profanity filter, reporting and 18+
 * rooms only). Pure, so it is tested like the game rules and runs the same on server and phone.
 *
 * - Slurs, hate and threats are refused outright, also when spelt with numbers or symbols.
 * - Contact details (links, emails, phone numbers, @handles) are refused, so nobody can be found
 *   from an answer.
 * - Common swear words are masked with asterisks; the answer still goes through.
 *
 * The lists are deliberately short and severe; reporting catches what a list cannot.
 */

export type FilterResult =
  { ok: true; text: string } | { ok: false; reason: "blocked" | "contact" | "empty" | "long" };

export const MAX_TEXT = 140;

// Severe terms, refused. Matched on whole words after folding look-alike characters.
const BLOCKED_WORDS = [
  "nigger",
  "nigga",
  "niggas",
  "niggers",
  "faggot",
  "faggots",
  "fag",
  "fags",
  "retard",
  "retards",
  "retarded",
  "chink",
  "chinks",
  "spic",
  "spics",
  "kike",
  "kikes",
  "tranny",
  "trannies",
  "dyke",
  "dykes",
  "coon",
  "coons",
  "paki",
  "pakis",
  "wetback",
  "gook",
  "raghead",
  "kys",
  "rape",
  "raped",
  "rapist",
];
// Severe phrases, refused, matched on the folded text with single spaces.
const BLOCKED_PHRASES = ["kill yourself", "kill urself", "go die", "hang yourself"];
// Swear words, masked. Whole words and their common endings.
const MASKED = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "bastard",
  "asshole",
  "wanker",
  "twat",
];

const LOOKALIKE: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

/** Lower case, look-alike characters folded, everything else that is not a letter a space. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$!|]/g, (c) => LOOKALIKE[c] ?? c)
    .replace(/[^a-z]+/g, " ")
    .trim();
}

const CONTACT = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(com|net|org|io|co|gh|ng|uk|me|app|xyz|link)\b/i,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  /(?:\d[\s().-]*){7,}/,
  /(^|\s)@[a-z0-9_.]{2,}/i,
];

export function filterText(input: string): FilterResult {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > MAX_TEXT) return { ok: false, reason: "long" };
  if (CONTACT.some((re) => re.test(text))) return { ok: false, reason: "contact" };

  const folded = fold(text);
  const words = new Set(folded.split(" "));
  // Also catch a term spread over spaced letters ("n i g g e r").
  const squashed = folded.replace(/ /g, "");
  if (
    BLOCKED_WORDS.some((w) => words.has(w)) ||
    BLOCKED_PHRASES.some((p) => ` ${folded} `.includes(` ${p} `)) ||
    BLOCKED_WORDS.filter((w) => w.length >= 5).some((w) => spaced(text, w) && squashed.includes(w))
  )
    return { ok: false, reason: "blocked" };

  // Mask swear words in the original text, keeping the first letter.
  const masked = text.replace(/[A-Za-z0-9@$!|]+/g, (word) => {
    const f = fold(word).replace(/ /g, "");
    const hit = MASKED.find(
      (m) => f === m || (f.startsWith(m) && /^(s|es|er|ers|ing|ed|y)$/.test(f.slice(m.length))),
    );
    return hit ? word[0] + "*".repeat(Math.max(1, word.length - 1)) : word;
  });
  return { ok: true, text: masked };
}

/** Whether the text spells the word with single letters separated by spaces or dots. */
function spaced(text: string, word: string): boolean {
  const pattern = word.split("").join("[\\s._-]+");
  return new RegExp(`(^|[^a-z])${pattern}([^a-z]|$)`, "i").test(
    text.toLowerCase().replace(/[013457@$!|]/g, (c) => LOOKALIKE[c] ?? c),
  );
}
