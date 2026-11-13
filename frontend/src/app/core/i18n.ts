// =====================================================================
// Traduction du site (français par défaut, anglais au choix).
//
// Les textes restent écrits en français dans les templates ; la clé de
// traduction EST le texte français :
//     {{ 'Voir le catalogue' | t }}
//     {{ 'Bonjour {name}' | t: { name: user.firstName } }}
//     this.i18n.t('Panier vide')            (dans le code)
// En anglais, la phrase est cherchée dans EN (core/i18n-en.ts) ; une phrase
// absente du dictionnaire s'affiche en français (et est signalée en dev).
//
// Le choix est mémorisé dans le navigateur, appliqué à <html lang> et envoyé
// à l'API (en-tête Accept-Language) pour que ses messages suivent la langue.
// =====================================================================

import { Injectable, Pipe, PipeTransform, effect, inject, isDevMode, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { EN } from './i18n-en';

export type Lang = 'fr' | 'en';
export type TParams = Record<string, string | number | null | undefined>;

const KEY = 'bytebazaar_lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

/** Langue courante, lisible hors injection (intercepteur HTTP, utilitaires). */
let current: Lang = readLang();
export const currentLang = () => current;

const warned = new Set<string>();

/** Traduit un texte français dans la langue courante, puis remplace les {paramètres}. */
export function translate(fr: string, params?: TParams, lang: Lang = current): string {
  let text = fr;
  if (lang === 'en') {
    const en = EN[fr];
    if (en !== undefined) text = en;
    else if (isDevMode() && !warned.has(fr)) {
      warned.add(fr);
      console.warn(`[i18n] traduction anglaise manquante : « ${fr} »`);
    }
  }
  if (params) text = text.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] ?? '').toString());
  return text;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(current);

  constructor() {
    effect(() => {
      const lang = this.lang();
      current = lang;
      document.documentElement.lang = lang;
      try {
        localStorage.setItem(KEY, lang);
      } catch {
        // stockage indisponible : le choix vaut pour la session
      }
    });
  }

  toggle() {
    this.lang.update((l) => (l === 'fr' ? 'en' : 'fr'));
  }

  /** Traduction (lit la langue : à utiliser dans un computed ou un template pour suivre le changement). */
  t(fr: string, params?: TParams): string {
    return translate(fr, params, this.lang());
  }

  /** Nom localisé d'une catégorie (nameFr / nameEn fournis par l'API). */
  name(item: { nameFr: string; nameEn?: string | null } | null | undefined): string {
    if (!item) return '';
    return this.lang() === 'en' && item.nameEn ? item.nameEn : item.nameFr;
  }

  /** Locale des nombres et des dates */
  locale(): string {
    return this.lang() === 'en' ? 'en-GB' : 'fr-FR';
  }
}

/** {{ 'Texte français' | t }} — impur : se met à jour quand on change de langue. */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(fr: string | null | undefined, params?: TParams): string {
    return fr ? this.i18n.t(fr, params) : '';
  }
}

/** {{ categorie | localName }} — nom d'une catégorie dans la langue courante. */
@Pipe({ name: 'localName', pure: false })
export class LocalNamePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(item: { nameFr: string; nameEn?: string | null } | null | undefined): string {
    return this.i18n.name(item);
  }
}

// Couleurs écrites en français à la fin du nom des produits : « Souris X (Noir) », « Clavier Y (Bleu / Teal) »
const COLOURS_EN: Record<string, string> = {
  Noir: 'Black',
  Blanc: 'White',
  Argent: 'Silver',
  Gris: 'Grey',
  Bleu: 'Blue',
  Rouge: 'Red',
  Violet: 'Purple',
  Vert: 'Green',
  Or: 'Gold',
  Jaune: 'Yellow',
  Rose: 'Pink',
  Marron: 'Brown',
  Beige: 'Beige',
  Orange: 'Orange',
  Transparent: 'Clear',
  Multicolore: 'Multicolour',
};

/** Nom du produit dans la langue courante : seule la couleur finale entre parenthèses est traduite. */
export function localProductName(name: string, lang: Lang = current): string {
  if (lang !== 'en') return name;
  return name.replace(/\(([^()]*)\)\s*$/, (all, inner: string) => {
    const parts = inner.split(/(\s*[/,]\s*)/);
    if (!parts.some((p) => COLOURS_EN[p])) return all;
    return `(${parts.map((p) => COLOURS_EN[p] ?? p).join('')})`;
  });
}

/** {{ produit.name | productName }} — couleur du nom traduite en anglais. */
@Pipe({ name: 'productName', pure: false })
export class ProductNamePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(name: string | null | undefined): string {
    return name ? localProductName(name, this.i18n.lang()) : '';
  }
}

/** Titre de l'onglet traduit (les titres des routes sont écrits en français). */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private last: RouterStateSnapshot | null = null;

  constructor() {
    super();
    // Changement de langue : le titre de la page affichée suit
    effect(() => {
      this.i18n.lang();
      if (this.last) this.updateTitle(this.last);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.last = snapshot;
    const title = this.buildTitle(snapshot);
    if (title) this.title.setTitle(this.i18n.t(title));
  }
}
