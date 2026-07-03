import { defineConfig } from "@playwright/test";

const browserChannel = (
  globalThis as typeof globalThis & {
    readonly process?: {
      readonly env?: Record<string, string | undefined>;
    };
  }
).process?.env?.PLAYWRIGHT_CHANNEL;

const browserChannelOptions = browserChannel === "chrome" ? { channel: "chrome" as const } : {};

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...browserChannelOptions,
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
