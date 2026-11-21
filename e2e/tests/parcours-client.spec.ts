import { expect, test } from '@playwright/test';
import { frenchLightSite, login, uniqueEmail } from './helpers';

test.beforeEach(async ({ page }) => frenchLightSite(page));

// Parcours complet d'un nouveau client, de l'inscription à l'annulation de sa commande
test('inscription, panier, commande, suivi et annulation', async ({ page }) => {
  const email = uniqueEmail();
  const password = 'motdepasse-e2e';
  let reference = '';

  await test.step('inscription', async () => {
    await page.goto('/inscription');
    await page.locator('#firstName').fill('Test');
    await page.locator('#lastName').fill('Bout-en-bout');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  });

  await test.step('ajout au panier depuis une fiche produit', async () => {
    await page.goto('/produits?inStock=true');
    await page.locator('a.card.product').first().click();
    await page.getByRole('button', { name: 'Ajouter au panier', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Voir mon panier' })).toContainText('1');
  });

  await test.step('quantité modifiée dans le panier', async () => {
    await page.goto('/panier');
    await page.getByRole('button', { name: '+' }).first().click();
    await expect(page.locator('.qty-controls span').first()).toHaveText('2');
    await expect(page.getByRole('link', { name: 'Voir mon panier' })).toContainText('2');
  });

  await test.step('paiement à la livraison avec une nouvelle adresse', async () => {
    await page.getByRole('link', { name: 'Passer la commande' }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await page.locator('#recipientName').fill('Test Bout-en-bout');
    await page.locator('#phone').fill('98 123 456');
    await page.locator('#street').fill('12 rue de Marseille');
    await page.locator('#governorate').selectOption({ index: 1 });
    await page.locator('#city').fill('Tunis');
    await page.locator('#postalCode').fill('1000');
    await page.getByRole('radio', { name: /Paiement à la livraison/ }).check();
    await page.getByRole('button', { name: 'Confirmer la commande' }).click();

    await expect(page).toHaveURL(/\/commandes\/\d+\?nouvelle=1/);
    await expect(
      page.getByRole('heading', { name: 'Merci, votre commande est confirmée !' }),
    ).toBeVisible();
    reference = (await page.getByRole('heading', { name: /Commande BB-/ }).innerText())
      .replace('Commande ', '')
      .trim();
    expect(reference).toMatch(/^BB-\d{6}-\d{3}$/);
    // Le panier est vidé après la commande
    await expect(page.getByRole('link', { name: 'Voir mon panier' })).not.toContainText(/\d/);
  });

  await test.step('commande visible dans « Mes commandes »', async () => {
    await page.goto('/compte/commandes');
    await expect(page.getByText(reference)).toBeVisible();
  });

  await test.step('annulation par le client', async () => {
    // Commandes les plus récentes en premier : celle de ce test
    await page
      .getByRole('link', { name: /Voir le détail/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: `Commande ${reference}` })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler la commande' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(reference);
    await dialog.getByRole('button', { name: 'Annuler la commande' }).click();
    await expect(page.getByText('Annulée').first()).toBeVisible();
  });

  await test.step('déconnexion puis reconnexion', async () => {
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('link', { name: 'Connexion' }).first()).toBeVisible();
    await login(page, email, password);
  });
});

test('inscription refusée (e-mail déjà utilisé) et validation des requêtes', async ({
  page,
  request,
}) => {
  const email = uniqueEmail('doublon');
  const account = { email, password: 'motdepasse-e2e', firstName: 'Test', lastName: 'Doublon' };
  // Inscriptions limitées à 10 par IP et par quart d'heure : ce compte sert aussi au test de validation
  const created = await request.post('/api/auth/register', { data: account });
  expect(created.status()).toBe(201);
  const auth = { Authorization: `Bearer ${(await created.json()).accessToken}` };

  await test.step('API : corps de requête invalide, messages traduits', async () => {
    const fr = await request.post('/api/cart/items', { data: { productId: 'abc' }, headers: auth });
    expect(fr.status()).toBe(400);
    expect((await fr.json()).message).toEqual(['Produit invalide']);
    const en = await request.post('/api/cart/items', {
      data: { productId: 'abc' },
      headers: { ...auth, 'Accept-Language': 'en' },
    });
    expect((await en.json()).message).toEqual(['Invalid product']);
  });

  await page.goto('/inscription');
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Doublon');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('motdepasse-e2e');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Un compte existe déjà avec cet email')).toBeVisible();
  await expect(page).toHaveURL(/\/inscription/);
});
