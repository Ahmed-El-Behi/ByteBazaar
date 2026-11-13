import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth-interceptor';
import { TranslatedTitleStrategy } from './core/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // Fondu entre les pages ; ignoré pour les changements de paramètres (filtres du catalogue)
      withViewTransitions({
        onViewTransitionCreated: ({ transition, from, to }) => {
          const path = (s: typeof from) => s.root.firstChild?.routeConfig?.path ?? '';
          // Même page (filtres, pagination) : pas d'animation, sans annuler la transition
          // (skipTransition() ferait journaliser une erreur par le routeur)
          const root = document.documentElement;
          root.classList.toggle('vt-instant', path(from) === path(to));
          transition.finished.finally(() => root.classList.remove('vt-instant')).catch(() => undefined);
        },
      }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Titres des onglets traduits selon la langue choisie
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
  ],
};