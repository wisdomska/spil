import { expect, test } from "@playwright/test";
import { fillProfile, passAgeGate, phone, pickGame } from "./harness";

// Editions (owner request 2026-11-24): next to the length, only for packs with local questions,
// with the best fit already picked; the host can change it in the lobby.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "runs once");
});

test("the host picks an edition with the length and can change it in the lobby", async ({
  browser,
}) => {
  const { context, page } = await phone(browser, "host");
  await page.goto("/create");
  await passAgeGate(page, 25);
  await pickGame(page);

  const packs = page.getByRole("radiogroup", { name: "Question pack" });
  const edition = page.getByRole("radiogroup", { name: "Edition" });

  // A pack with nothing local: no edition to pick.
  await packs
    .getByRole("radio", { name: /Group Chat/i })
    .first()
    .click();
  await expect(edition).toHaveCount(0);

  // Classic has local questions: Global is picked unless the phone is in Ghana or Nigeria.
  await packs
    .getByRole("radio", { name: /Classic/i })
    .first()
    .click();
  await expect(edition.getByRole("radio", { name: "Global" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await edition.getByRole("radio", { name: "Ghana" }).click();
  await expect(edition.getByRole("radio", { name: "Ghana" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: /^Continue with/ }).click();

  await page.waitForURL(/\/r\/[A-Z0-9]{4}\/me$/, { timeout: 30_000 });
  const code = page.url().match(/\/r\/([A-Z0-9]{4})\/me/)![1]!;
  await passAgeGate(page, 25);
  await fillProfile(page, "Kofi");
  await page.getByRole("button", { name: "Open the lobby" }).click();
  await page.waitForURL(new RegExp(`/r/${code}$`));

  const lobby = page.getByRole("region", { name: "Game setup" }).getByRole("radiogroup", {
    name: "Edition",
  });
  await expect(lobby.getByRole("radio", { name: "Ghana" })).toHaveAttribute("aria-checked", "true");
  await lobby.getByRole("radio", { name: "Naija" }).click();
  await expect(lobby.getByRole("radio", { name: "Naija" })).toHaveAttribute("aria-checked", "true");
  const state = await (await page.request.get(`/api/v1/rooms/${code}/state`)).json();
  expect(state.room.edition).toBe("NG");

  // The last pick is remembered for the next game on this phone.
  await page.goto("/create?game=classic");
  await packs
    .getByRole("radio", { name: /Classic/i })
    .first()
    .click();
  await expect(edition.getByRole("radio", { name: "Naija" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await context.close();
});
