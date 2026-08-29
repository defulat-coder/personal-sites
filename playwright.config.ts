import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: true,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:7100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm exec next start --hostname 127.0.0.1 --port 7100",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:7100/ask",
  },
});
