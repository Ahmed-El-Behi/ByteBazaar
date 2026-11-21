import { expect, test } from '@playwright/test';
import { frenchLightSite } from './helpers';

test.beforeEach(async ({ page }) => frenchLightSite(page));

test('accueil : bandeau, vitrine et sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Le bazar des');
  await expect(page.getByRole('link', { name: /Voir le catalogue/ })).toBeVisible();
  // Sections sous le bandeau, construites dès que le navigateur est libre (@defer)
  await expect(
    page.getByRole('heading', { name: 'Chaque pièce. Tout son potentiel.' }),
  ).toBeAttached();
  await expect(page.locator('footer.footer')).toBeAttached();
});

test('catalogue : filtre par catégorie et fiche produit', async ({ page }) => {
  await page.goto('/produits?category=cartes-graphiques&inStock=true');
  await expect(page.getByText(/\d+ produit\(s\)/)).toBeVisible();
  const first = page.locator('a.card.product').first();
  await expect(first).toBeVisible();
  const name = (await first.locator('h3').innerText()).trim();

  await first.click();
  await expect(page).toHaveURL(/\/produits\/[\w-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.locator('strong.price')).toContainText('TND');
  await expect(page.getByRole('button', { name: 'Ajouter au panier', exact: true })).toBeVisible();
});

test('recherche : par nom de produit ou par marque', async ({ page }) => {
  await page.goto('/produits?q=ryzen');
  const names = page.locator('a.card.product h3');
  await expect(names.first()).toBeVisible();
  for (const name of (await names.allInnerTexts()).slice(0, 5))
    expect(name.toLowerCase()).toContain('ryzen');
});

test('panier invité : un visiteur sans compte peut remplir son panier', async ({ page }) => {
  await page.goto('/produits?inStock=true');
  await page.locator('a.card.product').first().click();
  const name = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  await page.getByRole('button', { name: 'Ajouter au panier', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Voir mon panier' })).toContainText('1');

  await page.goto('/panier');
  await expect(page.getByRole('heading', { name: name, exact: true })).toBeVisible();
});
