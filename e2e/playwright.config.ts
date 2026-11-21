import { defineConfig, devices } from '@playwright/test';

/**
 * Le site doit tourner avant les tests : build de production servi par `npm run serve` (port 4300,
 * qui relaie /api vers l'API). Voir README.md (« Tests de bout en bout »).
 * E2E_BASE_URL change l'adresse ; E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD activent les tests admin.
 */
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Parcours qui écrivent en base (compte, panier, commande) : un à la fois, dans l'ordre
  workers: 1,
  fullyParallel: false,
  // Une seconde tentative ; un test qui ne passe qu'à la seconde est signalé « flaky » dans le rapport
  retries: 1,
  forbidOnly: CI,
  reporter: CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4300',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // En local : le Chrome installé (rien à télécharger) ; en CI : le Chromium de Playwright
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        ...(CI ? {} : { channel: 'chrome' }),
      },
    },
  ],
});
