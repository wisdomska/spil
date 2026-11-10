import { expect, test } from "@playwright/test";
import { fillProfile, joinRoom, passAgeGate, phone } from "./harness";

// Two-step game setup (owner request 2026-10-26): one tap for games with one pack, a pack step
// for the rest, a game setup card in the lobby, and Play again.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

const ROOM_ME = /\/r\/([A-Z0-9]{4})\/me$/;

test("each card says what a tap does, and one-tap games go straight in", async ({ browser }) => {
  const { page, context } = await phone(browser, "guest");
  await page.goto("/create");
  await passAgeGate(page);
  await expect(page.getByRole("heading", { name: "What are we playing?" })).toBeVisible();

  // The classic leads with its pack count; one-pack games say Start.
  await expect(page.getByRole("button", { name: /^Spill Score \d+ packs$/ })).toBeVisible();
  for (const name of ["Hot Takes", "Most Likely To", "Rank the Room", "Imposter"])
    await expect(page.getByRole("button", { name: `${name} Start` })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Room Percentage \d+ packs$/ })).toBeVisible();
  for (const group of ["Guess each other", "Vote and rank", "Bluff and catch"])
    await expect(page.getByRole("heading", { name: group })).toBeVisible();
  // Spill or Skip is a switch on the classic pack step, not a card.
  await expect(page.getByRole("button", { name: /^Spill or Skip/ })).toHaveCount(0);

  // One tap: no pack step, straight to the name screen, then a lobby with the length chips.
  await page.getByRole("button", { name: "Hot Takes Start" }).click();
  await page.waitForURL(ROOM_ME, { timeout: 30_000 });
  await fillProfile(page, "Ama");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  const setup = page.getByRole("region", { name: "Game setup" });
  await expect(setup).toContainText("Hot Takes");
  const five = setup.getByRole("radio", { name: "5", exact: true });
  await five.click();
  await expect(five).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Game setup" }).getByRole("radio", { name: "5", exact: true }),
  ).toHaveAttribute("aria-checked", "true");

  // A mis-tap is one tap to undo: Change, then another one-tap game.
  await page.getByRole("link", { name: /^Change the game or pack/ }).click();
  await expect(page.getByRole("heading", { name: "Change the game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hot Takes Start" })).toContainText("Playing now");
  await page.getByRole("button", { name: "Most Likely To Start" }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{4}$/);
  await expect(page.getByRole("region", { name: "Game setup" })).toContainText("Most Likely To");

  // Play again: the last game this phone set up, one tap.
  await page.goto("/create");
  const again = page.getByRole("button", { name: /^Play again/ });
  await expect(again).toContainText("Hot Takes");
  await again.click();
  await page.waitForURL(ROOM_ME, { timeout: 30_000 });
  await context.close();
});

test("games with several packs open a pack step that Back returns from", async ({ browser }) => {
  const host = await phone(browser, "host");
  const page = host.page;
  await page.goto("/create");
  await passAgeGate(page);
  await page.getByRole("button", { name: /^Spill Score/ }).click();
  await page.waitForURL(/game=classic/);
  await expect(page.getByRole("heading", { name: "Pick your poison." })).toBeVisible();
  await expect(page.getByText("Game:")).toBeVisible();

  // Back (browser and link) returns to the games.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "What are we playing?" })).toBeVisible();
  await page.goForward();
  await page.getByRole("button", { name: "Change game" }).click();
  await expect(page.getByRole("heading", { name: "What are we playing?" })).toBeVisible();

  // The story vote switch turns the classic into Spill or Skip.
  await page.getByRole("button", { name: /^Spill Score/ }).click();
  const story = page.getByRole("switch", { name: /story vote at the end/i });
  await story.click();
  await page.waitForURL(/game=spill_or_skip/);
  await expect(story).toBeChecked();
  await page
    .getByRole("radiogroup", { name: "Question pack" })
    .getByRole("radio", { name: /Campus Life/ })
    .click();
  await page.getByRole("button", { name: /^Continue with Campus Life/ }).click();
  await page.waitForURL(ROOM_ME, { timeout: 30_000 });
  const code = page.url().match(ROOM_ME)![1]!;
  await fillProfile(page, "Ama");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  const setup = page.getByRole("region", { name: "Game setup" });
  await expect(setup).toContainText("Spill or Skip");
  await expect(setup).toContainText("Campus Life");

  // A guest sees the game too; only the host gets the setup card.
  const guest = await phone(browser, "guest");
  await joinRoom(guest.page, code, { nickname: "Esi" });
  await expect(guest.page.getByRole("region", { name: "Game setup" })).toHaveCount(0);
  for (const p of [host, guest]) await p.context.close();
});

// UX audit 2026-11-09: a game page link to a one-pack game reads as setting it up, and a link to
// an 18+ game on a younger phone says why it is not offered.
test("game page links: one pack reads Set up your game, an 18+ game says why", async ({
  browser,
}) => {
  const adult = await phone(browser, "host");
  await adult.page.goto("/create?game=hot_takes");
  await passAgeGate(adult.page);
  await expect(adult.page.getByRole("heading", { name: "Set up your game." })).toBeVisible();

  const teen = await phone(browser, "guest");
  await teen.page.goto("/create?game=who_said");
  await passAgeGate(teen.page, 15);
  await expect(teen.page.getByRole("heading", { name: "What are we playing?" })).toBeVisible();
  await expect(
    teen.page.getByText(/Who Said That\? is only for rooms where everyone is 18/),
  ).toBeVisible();
  for (const p of [adult, teen]) await p.context.close();
});
