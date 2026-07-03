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

  expect(consoleErrors).toEqual([]);
});
