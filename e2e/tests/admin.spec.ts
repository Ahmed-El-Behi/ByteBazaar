import { expect, test } from '@playwright/test';
import { frenchLightSite, login } from './helpers';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('administration', () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'compte administrateur non fourni (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)',
  );
  test.beforeEach(async ({ page }) => frenchLightSite(page));

  test('tableau de bord, commandes et stock', async ({ page }) => {
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);

    await page.goto('/admin');
    await expect(page.locator('.kpis')).toBeVisible();
    await page.getByRole('radio', { name: '90 jours' }).click();
    await expect(page.getByRole('radio', { name: '90 jours' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('.kpis')).toBeVisible();

    await page.goto('/admin/commandes');
    await expect(page.getByRole('heading', { name: 'Commandes', level: 1 })).toBeVisible();
    await expect(page.locator('tr.row').first()).toBeVisible();

    await page.goto('/admin/stock');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test('un visiteur non connecté ne peut pas ouvrir l’administration', async ({ page, request }) => {
  await frenchLightSite(page);
  expect((await request.get('/api/admin/dashboard')).status()).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/connexion\?redirect=/);
});
