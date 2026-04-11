import { expect, test } from "@playwright/test";

test("campaign mission bootstraps into active gameplay", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.ironPulseRuntime));

  await page.evaluate(() => {
    window.ironPulseRuntime?.startCampaignMission("dock-breach");
  });

  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.advanceTime?.(2000);
  });

  const rawState = await page.evaluate(() => window.render_game_to_text?.());
  const state = JSON.parse(rawState ?? "{}");

  expect(state.mode).toBe("campaign");
  expect(state.mission).toBe("dock-breach");
  expect(state.player.hp).toBeGreaterThan(0);
  expect(state.combat.enemiesAlive).toBeGreaterThan(0);
});
