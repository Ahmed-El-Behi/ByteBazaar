// =====================================================================
// Langue de la réponse (français par défaut, anglais sur demande).
//
// Le frontend envoie l'en-tête « Accept-Language: fr | en » à chaque requête ;
// le middleware langMiddleware le lit et le garde pour toute la durée de la
// requête (AsyncLocalStorage). Partout dans le code, tr('texte FR', 'English
// text') renvoie le texte dans la langue de la requête en cours.
// =====================================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export type Lang = 'fr' | 'en';

const storage = new AsyncLocalStorage<Lang>();

/** Langue de la requête en cours (français hors requête : seed, scripts, tests). */
export function currentLang(): Lang {
  return storage.getStore() ?? 'fr';
}

/** Texte dans la langue de la requête en cours. */
export function tr(fr: string, en: string): string {
  return currentLang() === 'en' ? en : fr;
}

/** Exécute `fn` dans une langue donnée (utile pour les tests). */
export function withLang<T>(lang: Lang, fn: () => T): T {
  return storage.run(lang, fn);
}

/** Langue demandée par l'en-tête Accept-Language : anglais seulement s'il est cité en premier. */
export function parseLang(header: string | undefined): Lang {
  return /^\s*en\b/i.test(header ?? '') ? 'en' : 'fr';
}

export function langMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  storage.run(parseLang(req.headers['accept-language']), next);
}
