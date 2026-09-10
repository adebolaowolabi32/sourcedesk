import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3011", trace: "retain-on-failure" },
  webServer: {
    command: "PORT=3011 DB_PATH=:memory: ANSWER_MODE=extractive npm start",
    url: "http://127.0.0.1:3011/api/health",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
