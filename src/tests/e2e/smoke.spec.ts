import { expect, test } from "@playwright/test";

test("NULLPOINT boots, renders, starts, and toggles perf overlay", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.getByTestId("game-canvas")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();

  await expect
    .poll(async () => page.evaluate(() => window.__NULLPOINT_PHASE__), {
      message: "runtime reaches Menu phase",
    })
    .toBe("Menu");

  await page.getByTestId("play-button").click();

  await expect
    .poll(async () => page.evaluate(() => window.__NULLPOINT_PHASE__), {
      message: "play command reaches Playing phase",
    })
    .toBe("Playing");

  const startingPosition = await page.evaluate(() => window.__NULLPOINT_PLAYER__?.position);

  await page.keyboard.down("w");
  await page.waitForTimeout(1_000);
  await page.keyboard.up("w");

  await expect
    .poll(
      async () =>
        page.evaluate((start) => {
          const position = window.__NULLPOINT_PLAYER__?.position;
          if (!position || !start) {
            return 0;
          }

          return Math.hypot(position.x - start.x, position.z - start.z);
        }, startingPosition),
      {
        message: "holding W moves the player",
      },
    )
    .toBeGreaterThan(0.5);

  await expect
    .poll(
      async () =>
        page.getByTestId("game-canvas").evaluate((canvasElement) => {
          const canvas = canvasElement as HTMLCanvasElement;
          const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
          if (!context || canvas.width === 0 || canvas.height === 0) {
            return false;
          }

          const centerX = Math.floor(canvas.width / 2);
          const centerY = Math.floor(canvas.height / 2);
          const pixel = new Uint8Array(4);
          context.readPixels(centerX, centerY, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
          return Array.from(pixel).some((value) => value > 0);
        }),
      {
        message: "canvas is rendering non-black pixels",
      },
    )
    .toBe(true);

  await page.keyboard.press("F3");
  await expect(page.getByTestId("perf-overlay")).toBeVisible();
  await expect(page.getByTestId("perf-overlay")).toContainText("FPS");
  await expect(page.getByTestId("perf-overlay")).toContainText("Draw calls");
  await expect(page.getByTestId("perf-overlay")).toContainText("State");

  await page.keyboard.press("Escape");
  await expect
    .poll(async () => page.evaluate(() => window.__NULLPOINT_PHASE__), {
      message: "Escape reaches Paused phase",
    })
    .toBe("Paused");

  expect(consoleErrors).toEqual([]);
});
