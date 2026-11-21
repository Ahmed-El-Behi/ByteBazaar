import { expect, test } from '@playwright/test';
import { frenchLightSite } from './helpers';

test.beforeEach(async ({ page }) => frenchLightSite(page));

test('configurateur : choix d’un processeur, récapitulatif et pièces compatibles', async ({
  page,
}) => {
  await page.goto('/configurateur');
  await expect(page.getByRole('heading', { name: 'Configurateur PC' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Votre configuration' })).toBeVisible();

  // Emplacement « Processeur » : la liste des pièces s'ouvre
  const slot = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) }).first();
  await slot('Processeur').click();
  const cards = page.locator('.picker-card');
  await expect(cards.first()).toBeVisible();
  const cpu = (await cards.first().locator('.product-title').innerText()).trim();
  await cards.first().getByRole('button', { name: 'Sélectionner' }).click();
  await expect(page.locator('.modal-backdrop')).toBeHidden();

  // Le processeur choisi apparaît dans l'emplacement et dans le récapitulatif (avec son prix)
  await expect(slot('Processeur')).toContainText(cpu.slice(0, 20));
  await expect(page.locator('.summary-card')).toContainText('TND');

  // Cartes mères : seules celles compatibles avec ce processeur sont proposées
  await slot('Carte mère').click();
  await expect(page.locator('.picker-card').first()).toBeVisible();
  await expect(page.getByText(/incompatible/i).first()).toBeVisible();
});
