import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'bytebazaar_theme';

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // stockage indisponible : thème clair par défaut
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(readTheme());

  constructor() {
    effect(() => {
      const value = this.theme();
      document.documentElement.dataset['theme'] = value;
      try {
        localStorage.setItem(KEY, value);
      } catch {
        // stockage indisponible : rien à faire
      }
    });
  }

  toggle() {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}
