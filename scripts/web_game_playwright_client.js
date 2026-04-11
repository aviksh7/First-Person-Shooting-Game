import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    url: null,
    iterations: 3,
    pauseMs: 250,
    headless: true,
    screenshotDir: "output/web-game",
    actionsFile: null,
    actionsJson: null,
    click: null,
    clickSelector: null,
    evalJs: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url" && next) {
      args.url = next;
      i += 1;
    } else if (arg === "--iterations" && next) {
      args.iterations = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--pause-ms" && next) {
      args.pauseMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--headless" && next) {
      args.headless = next !== "0" && next !== "false";
      i += 1;
    } else if (arg === "--screenshot-dir" && next) {
      args.screenshotDir = next;
      i += 1;
    } else if (arg === "--actions-file" && next) {
      args.actionsFile = next;
      i += 1;
    } else if (arg === "--actions-json" && next) {
      args.actionsJson = next;
      i += 1;
    } else if (arg === "--click" && next) {
      const parts = next.split(",").map((value) => Number.parseFloat(value.trim()));
      if (parts.length === 2 && parts.every((value) => Number.isFinite(value))) {
        args.click = { x: parts[0], y: parts[1] };
      }
      i += 1;
    } else if (arg === "--click-selector" && next) {
      args.clickSelector = next;
      i += 1;
    } else if (arg === "--eval-js" && next) {
      args.evalJs = next;
      i += 1;
    }
  }

  if (!args.url) {
    throw new Error("--url is required");
  }

  return args;
}

const buttonNameToKey = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  enter: "Enter",
  space: "Space",
  a: "KeyA",
  b: "KeyB",
  w: "KeyW",
  s: "KeyS",
  d: "KeyD",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureDir = (target) => fs.mkdirSync(target, { recursive: true });

async function getCanvasHandle(page) {
  const handle = await page.evaluateHandle(() => {
    let best = null;
    let bestArea = 0;
    for (const canvas of document.querySelectorAll("canvas")) {
      const area = (canvas.width || canvas.clientWidth || 0) * (canvas.height || canvas.clientHeight || 0);
      if (area > bestArea) {
        bestArea = area;
        best = canvas;
      }
    }
    return best;
  });
  return handle.asElement();
}

async function captureCanvasPngBase64(canvas) {
  return canvas.evaluate((target) => {
    if (!target || typeof target.toDataURL !== "function") {
      return "";
    }
    const data = target.toDataURL("image/png");
    const idx = data.indexOf(",");
    return idx === -1 ? "" : data.slice(idx + 1);
  });
}

async function isCanvasTransparent(canvas) {
  return canvas.evaluate((target) => {
    try {
      const width = target.width || target.clientWidth || 0;
      const height = target.height || target.clientHeight || 0;
      if (!width || !height) {
        return true;
      }
      const probe = document.createElement("canvas");
      const size = Math.max(1, Math.min(16, width, height));
      probe.width = size;
      probe.height = size;
      const ctx = probe.getContext("2d");
      if (!ctx) {
        return true;
      }
      ctx.drawImage(target, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });
}

async function captureScreenshot(page, canvas, outputPath) {
  let buffer = null;
  const base64 = canvas ? await captureCanvasPngBase64(canvas) : "";
  if (base64) {
    buffer = Buffer.from(base64, "base64");
    if (canvas && (await isCanvasTransparent(canvas))) {
      buffer = null;
    }
  }
  if (!buffer && canvas) {
    try {
      buffer = await canvas.screenshot({ type: "png" });
    } catch {
      buffer = null;
    }
  }
  if (!buffer) {
    buffer = await page.screenshot({ type: "png", omitBackground: false });
  }
  fs.writeFileSync(outputPath, buffer);
}

class ConsoleErrorTracker {
  constructor() {
    this.errors = [];
    this.seen = new Set();
  }

  ingest(error) {
    const serialized = JSON.stringify(error);
    if (this.seen.has(serialized)) {
      return;
    }
    this.seen.add(serialized);
    this.errors.push(error);
  }

  drain() {
    const snapshot = [...this.errors];
    this.errors = [];
    return snapshot;
  }
}

async function doChoreography(page, canvas, steps) {
  for (const step of steps) {
    const buttons = new Set(step.buttons || []);
    for (const button of buttons) {
      if (button === "left_mouse_button" || button === "right_mouse_button") {
        const box = canvas ? await canvas.boundingBox() : null;
        if (!box) continue;
        const x = typeof step.mouse_x === "number" ? step.mouse_x : box.width / 2;
        const y = typeof step.mouse_y === "number" ? step.mouse_y : box.height / 2;
        await page.mouse.move(box.x + x, box.y + y);
        await page.mouse.down({ button: button === "left_mouse_button" ? "left" : "right" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.down(buttonNameToKey[button]);
      }
    }

    const frames = step.frames || 1;
    for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
      await page.evaluate(async () => {
        if (typeof window.advanceTime === "function") {
          await window.advanceTime(1000 / 60);
        }
      });
    }

    for (const button of buttons) {
      if (button === "left_mouse_button" || button === "right_mouse_button") {
        await page.mouse.up({ button: button === "left_mouse_button" ? "left" : "right" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.up(buttonNameToKey[button]);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  ensureDir(args.screenshotDir);

  const browser = await chromium.launch({
    headless: args.headless,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = new ConsoleErrorTracker();

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.ingest({ type: "console.error", text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.ingest({ type: "pageerror", text: String(error) });
  });

  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => Boolean(window.ironPulseRuntime), { timeout: 10000 });

  if (args.clickSelector) {
    try {
      await page.click(args.clickSelector, { timeout: 5000 });
    } catch (error) {
      console.warn(`Failed to click selector ${args.clickSelector}`, error);
    }
  }

  if (args.evalJs) {
    await page.evaluate((expression) => {
      // eslint-disable-next-line no-eval
      eval(expression);
    }, args.evalJs);
    await page.waitForTimeout(300);
  }

  let steps = null;
  if (args.actionsFile) {
    const parsed = JSON.parse(fs.readFileSync(args.actionsFile, "utf8"));
    steps = Array.isArray(parsed) ? parsed : parsed.steps;
  } else if (args.actionsJson) {
    const parsed = JSON.parse(args.actionsJson);
    steps = Array.isArray(parsed) ? parsed : parsed.steps;
  } else if (args.click) {
    steps = [{ buttons: ["left_mouse_button"], frames: 2, mouse_x: args.click.x, mouse_y: args.click.y }];
  }

  if (!steps) {
    throw new Error("Actions are required. Use --actions-file, --actions-json, or --click.");
  }

  let canvas = await getCanvasHandle(page);

  for (let iteration = 0; iteration < args.iterations; iteration += 1) {
    if (!canvas) {
      canvas = await getCanvasHandle(page);
    }
    await doChoreography(page, canvas, steps);
    await sleep(args.pauseMs);
    await captureScreenshot(page, canvas, path.join(args.screenshotDir, `shot-${iteration}.png`));

    const state = await page.evaluate(() => {
      if (typeof window.render_game_to_text === "function") {
        return window.render_game_to_text();
      }
      return null;
    });

    if (state) {
      fs.writeFileSync(path.join(args.screenshotDir, `state-${iteration}.json`), state);
    }

    const errors = consoleErrors.drain();
    if (errors.length > 0) {
      fs.writeFileSync(path.join(args.screenshotDir, `errors-${iteration}.json`), JSON.stringify(errors, null, 2));
      break;
    }
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
