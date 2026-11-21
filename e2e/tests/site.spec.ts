import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, frenchLightSite } from './helpers';

test.beforeEach(async ({ page }) => frenchLightSite(page));

test('langue : passage en anglais puis retour en français', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PC components');
  await page.getByRole('button', { name: 'Passer en français' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Le bazar des');
});

test('thème : bascule clair / sombre, mémorisée', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('switch', { name: 'Mode sombre' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

// Régression : l'en-tête rétrécit au défilement ; près du haut de la page, il oscillait sans fin
// (rétrécissement → ancrage du défilement → retour sous le seuil → agrandissement…)
test('en-tête stable quand la page est à quelques pixels du haut', async ({ page }) => {
  await page.goto('/');
  await page.locator('footer.footer').waitFor({ state: 'attached' });
  for (const y of [6, 10, 14, 20]) {
    const positions = await page.evaluate(async (y) => {
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 600)); // transition de l'en-tête : 0,25 s
      const button = document.querySelector('.lang-switch')!;
      const seen = new Set<number>();
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        seen.add(Math.round(button.getBoundingClientRect().y * 10));
      }
      return seen.size;
    }, y);
    expect(positions, `défilement à ${y} px`).toBe(1);
  }
});

test.describe('téléphone (390 × 844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  // Élément attendu une fois la page affichée
  const pages: [string, string][] = [
    ['/', 'h1'],
    ['/produits', 'a.card.product'],
    ['/connexion', 'h1'],
    ['/a-propos', 'h1'],
    ['/panier', 'h2'],
  ];
  for (const [path, ready] of pages) {
    test(`${path} : aucun défilement horizontal`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(`main ${ready}`).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});

test('API : état de santé et documentation Swagger', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ status: 'ok', database: 'connected' });

  await page.goto('/api/docs/');
  await expect(page.getByRole('heading', { name: /ByteBazaar — API/ })).toBeVisible();
  for (const tag of [
    'Catalogue',
    'Comptes',
    'Panier',
    'Commandes',
    'Configurateur',
    'Administration',
  ])
    await expect(page.locator(`h3.opblock-tag[data-tag="${tag}"]`)).toBeVisible();
});
