# ByteBazaar — site (Angular)

Voir le [README principal](../README.md) pour l'installation complète.

| Script               | Rôle                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `npm start`          | Serveur de développement (http://localhost:4200)                  |
| `npm run build`      | Build de production (`dist/frontend/browser`)                     |
| `npm run serve`      | Sert le build (http://localhost:4300) et relaie `/api` vers l'API |
| `npm test`           | Tests unitaires (Vitest)                                          |
| `npm run typecheck`  | Vérification TypeScript                                           |
| `npm run i18n:check` | Chaque texte traduit a son équivalent anglais                     |
| `npm run format`     | Mise en forme (Prettier)                                          |

## Organisation

- `src/app/pages/` — une page par route (chargées à la demande, sauf l'accueil et le catalogue).
- `src/app/components/` — composants partagés (carte produit, icônes, notifications) et vue 3D du configurateur
  (`pc-scene.ts`, `pc-model.ts`, `desk-model.ts`).
- `src/app/core/` — services d'API, état du panier, authentification, traduction (`i18n.ts`, `i18n-en.ts`),
  textes juridiques (`legal-content.ts`).
- `src/environments/` — URL de l'API : `/api` sur le même domaine (relayée par `proxy.conf.json` avec `ng serve`,
  par `scripts/serve.mjs` ou par le reverse proxy en production).
- `src/styles.css` — jetons du système de design (couleurs, typographie, rayons, ombres) et styles communs.

## Traduction

Les textes sont écrits en français dans les templates et traduits à l'affichage :
`{{ 'Voir le catalogue' | t }}`, `translate('…')` dans le code. Les traductions anglaises sont dans
`src/app/core/i18n-en.ts` ; `npm run i18n:check` signale tout texte sans traduction.
