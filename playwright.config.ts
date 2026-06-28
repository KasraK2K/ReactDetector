import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:0",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

