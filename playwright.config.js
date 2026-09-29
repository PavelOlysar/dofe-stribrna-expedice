// Checks for the built site (_site). Run `npm run build` first (the GitHub Action does both).
// The site is served exactly like GitHub Pages, including the /dofe-stribrna-expedice/ prefix
// when PATH_PREFIX is set.
import { defineConfig } from '@playwright/test';

const prefix = process.env.PATH_PREFIX || '/';
const port = 4173;

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${port}${prefix}`, browserName: 'chromium' },
  webServer: {
    command: `node tests/serve.mjs ${port}`,
    url: `http://localhost:${port}${prefix}`,
    reuseExistingServer: !process.env.CI,
    env: { PATH_PREFIX: prefix }
  }
});
