import { defineConfig } from "@playwright/test";

import { WORKER_STATE_FILE } from "./tests/e2e/worker-state";

const baseURL = "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "on-first-retry" },
  globalSetup: "tests/e2e/global-setup.ts",
  webServer: {
    // The server creates and owns the Worker's D1 directory and records it in
    // this file; the path travels as an explicit argument, never through the
    // environment.
    command: `node scripts/e2e-server.mjs --state-file "${WORKER_STATE_FILE}"`,
    url: `${baseURL}/_agent-native/ping`,
    timeout: 180_000,
    reuseExistingServer: false,
    // Without this Playwright ends the run with SIGKILL, which no handler can
    // catch, and the detached Wrangler process group survives holding port
    // 8787. SIGTERM reaches the script's handler, which stops that group.
    gracefulShutdown: { signal: "SIGTERM", timeout: 20_000 },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
