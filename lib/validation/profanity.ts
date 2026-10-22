// Nickname filter (spec section 18). The Content Lead maintains this list; matching is on
// whole words after folding case, accents, digit look-alikes and repeated letters, so
// "Sh1t", "SHIIIT" and "s.h.i.t" are caught but "Scunthorpe" and "Assana" are not.
const BLOCKED = [
  // English
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "bastard",
  "asshole",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "rapist",
  "rape",
  "nazi",
  "hitler",
  "porn",
  // Ghana and Nigeria (Twi, Ga, Pidgin, Yoruba, Igbo, Hausa) slurs and vulgar terms
  "kwasia",
  "kwasea",
  "aboa",
  "etwe",
  "kote",
  "gyimii",
  "ashawo",
  "olosho",
  "ode",
  "oloriburuku",
  "werey",
  "mumu",
  "ewu",
  "onye ara",
  "dan iska",
  "karuwa",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

function fold(input: string) {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

const squash = (s: string) => s.replace(/(.)\1+/g, "$1");

/** True when the nickname contains a blocked word. */
export function isProfane(nickname: string): boolean {
  const folded = fold(nickname);
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  const joined = folded.replace(/[^a-z]/g, "");
  return BLOCKED.some((term) => {
    const target = term.replace(/\s+/g, "");
    if (term.includes(" ")) return joined.includes(target);
    if (words.some((w) => w === term || squash(w) === squash(term))) return true;
    // Spelled out with separators, e.g. "s.h.i.t": every word is a single letter.
    return (
      target.length >= 4 && words.every((w) => w.length === 1) && squash(joined) === squash(target)
    );
  });
}
