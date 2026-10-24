import { expect, test, type Page, type Request } from "@playwright/test";
import { createRoom, joinRoom, passAgeGate, phone } from "./harness";

// SPIL-02: age gate, pack filtering by band, blocked join, the under-13 lock, and privacy.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

/** Every request a page sends, so the test can prove no exact age ever leaves the device. */
function recordRequests(page: Page) {
  const sent: string[] = [];
  page.on("request", (r: Request) => sent.push(`${r.url()} ${r.postData() ?? ""}`));
  return sent;
}

const NUMERIC_AGE = /"?\bage"?\s*[:=]\s*"?\d|[?&]age=\d/i;

test("18+ host and 15-year-old guest (SPIL-02)", async ({ browser }) => {
  const host = await phone(browser, "host");
  const teen = await phone(browser, "guest");
  const teenRequests = recordRequests(teen.page);
  const hostRequests = recordRequests(host.page);

  // The host is asked first, then sees adult packs last under their own heading.
  await host.page.goto("/create");
  await expect(host.page.getByText("STEP 1 OF 2")).toBeVisible();
  await passAgeGate(host.page, 30);
  await expect(host.page.getByRole("heading", { name: "After dark · 18+" })).toBeVisible();
  await expect(host.page.getByText("Playing as 18+")).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Not you?" })).toBeVisible();

  const code = await createRoom(host.page, { pack: "classic", count: 5, nickname: "Ama" });

  // The 15-year-old is asked before the nickname form, and their age is locked on the phone.
  await teen.page.goto(`/r/${code}/me`);
  await expect(teen.page.getByText("BEFORE YOU JOIN")).toBeVisible();
  await passAgeGate(teen.page, 15);
  await expect(teen.page.getByText("Playing as 13 to 15")).toBeVisible();
  await expect(teen.page.getByRole("button", { name: "Not you?" })).toHaveCount(0);
  await joinRoom(teen.page, code, { nickname: "Esi" });

  // In the lobby the host only gets packs for the youngest player, and nobody is named.
  await host.page.getByRole("link", { name: /Change pack/ }).click();
  await expect(host.page.getByText("Some packs are hidden for this room.")).toBeVisible();
  await expect(host.page.getByRole("radio", { name: /After Dark/ })).toHaveCount(0);
  await expect(host.page.getByText("After dark · 18+")).toHaveCount(0);

  // On their own /create the teen sees the 13+ packs and no hint that others exist.
  await teen.page.goto("/create");
  await expect(teen.page.getByRole("heading", { name: "Pick your poison." })).toBeVisible();
  await expect(teen.page.getByRole("radio", { name: /Classic/ })).toBeVisible();
  await expect(teen.page.getByRole("radio", { name: /After Dark|Between the Sheets/ })).toHaveCount(
    0,
  );
  expect(await teen.page.content()).not.toMatch(/After Dark|Between the Sheets|Kink Curious/);

  for (const sent of [...teenRequests, ...hostRequests]) expect(sent).not.toMatch(NUMERIC_AGE);
  await host.context.close();
  await teen.context.close();
});

test("16-year-old opening an 18+ room is blocked, no player is created (SPIL-02)", async ({
  browser,
}) => {
  const host = await phone(browser, "host");
  const code = await createRoom(host.page, { pack: "after dark", count: 5, nickname: "Ama" });

  const guest = await phone(browser, "guest");
  await guest.page.goto(`/r/${code}/me`);
  await passAgeGate(guest.page, 16);
  await expect(
    guest.page.getByRole("heading", { name: "This room is playing an 18+ pack." }),
  ).toBeVisible();
  await expect(guest.page.getByRole("link", { name: "Start a game" })).toBeVisible();
  await expect(guest.page.getByLabel("Nickname")).toHaveCount(0);

  // The host's lobby never changes: still just the host, and no word about who tried.
  await host.page.reload();
  await expect(host.page.getByText(/just you so far/i)).toBeVisible();
  await host.context.close();
  await guest.context.close();
});

test("under 13 is blocked and cannot retry on the same device (SPIL-02)", async ({ browser }) => {
  const kid = await phone(browser, "guest");
  await kid.page.goto("/create");
  await passAgeGate(kid.page, 12);
  await expect(
    kid.page.getByRole("heading", { name: "SPIL is for ages 13 and up." }),
  ).toBeVisible();
  await expect(kid.page.getByRole("link", { name: "Back home" })).toBeVisible();
  await kid.page.reload();
  await expect(
    kid.page.getByRole("heading", { name: "SPIL is for ages 13 and up." }),
  ).toBeVisible();
  await expect(kid.page.getByLabel("Your age")).toHaveCount(0);
  await kid.context.close();
});

test("age screen rejects ages that are not real (SPIL-02)", async ({ browser }) => {
  const p = await phone(browser, "guest");
  await p.page.goto("/create");
  const input = p.page.getByLabel("Your age");
  await input.fill("ab");
  await expect(input).toHaveValue("");
  await input.fill("0");
  await p.page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(p.page.getByText("Enter your real age.")).toBeVisible();
  await p.context.close();
});
