import { expect, type Page } from '@playwright/test';

/** Adresse e-mail unique par exécution : chaque test de compte crée son propre client. */
export function uniqueEmail(prefix = 'client'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@e2e.bytebazaar.test`;
}

/** Site en français et thème clair, quelles que soient les préférences du navigateur. */
export async function frenchLightSite(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.setItem('bytebazaar_lang', 'fr');
      localStorage.setItem('bytebazaar_theme', 'light');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/connexion');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
}

/** Aucun contenu plus large que l'écran (défilement horizontal). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
