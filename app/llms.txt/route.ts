import { getTranslations } from "next-intl/server";
import { GAME_PAGES, gameFacts } from "@/lib/game-pages";
import { absolute } from "@/lib/seo";

/**
 * /llms.txt: a plain summary of SPIL for AI assistants (llmstxt.org), built from the same copy as
 * the pages so it never drifts from them.
 */
export async function GET() {
  const t = await getTranslations();
  const games = GAME_PAGES.map(({ mode, slug }) => {
    const { minPlayers, adultOnly } = gameFacts(mode);
    const who = `${minPlayers === 1 ? "1" : minPlayers} to 12 players, ${adultOnly ? "18+" : "13+"}`;
    return `- [${t(`modes.${mode}.name`)}](${absolute(`/games/${slug}`)}): ${t(`games.modes.${mode}.tagline`)} ${who}.`;
  });
  const faq = (t.raw("faq.items") as Array<{ q: string; a: string }>)
    .map((i) => `### ${i.q}\n${i.a}`)
    .join("\n\n");
  const body = `# SPIL

> ${t("meta.description")}

SPIL is a free web app of party games for friends, played on everyone's own phone in the browser. One person starts a room and shares a link or a four character code; up to 12 people join with a nickname and a face. No app, no signup. Designed and developed by Senya. For ages 13 and older; 18+ games and packs only appear when everyone in the room is 18 or older.

## Games

${games.join("\n")}

## Pages

- [Home](${absolute("/")}): start or join a game.
- [All games](${absolute("/games")})
- [How to play](${absolute("/how-to-play")})
- [FAQ](${absolute("/faq")})
- [Today's Spill](${absolute("/daily")}): one question a day for everyone.
- [Safety](${absolute("/safety")}), [Privacy](${absolute("/privacy")}), [Terms](${absolute("/terms")})

## FAQ

${faq}
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
