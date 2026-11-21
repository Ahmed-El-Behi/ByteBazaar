# ByteBazaar — API (NestJS)

Voir le [README principal](../README.md) pour l'installation complète.

| Script                     | Rôle                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `npm run start:dev`        | API en mode développement (rechargement automatique)                       |
| `npm run seed`             | Synchronise le catalogue depuis `data/catalogue_local_images_cleaned.json` |
| `npm run seed:stock`       | Stock de test reproductible pour les produits à 0                          |
| `npm run seed:demo-orders` | ≈ 200 commandes fictives sur 120 jours (tableau de bord) ; relançable      |
| `npm test`                 | Tests unitaires                                                            |
| `npm run test:e2e`         | Tests d'intégration (base de développement requise)                        |
| `npm run lint`             | oxlint                                                                     |
| `npm run build`            | Compilation (`npm run start:prod` pour la lancer)                          |

Scripts de données (`scripts/`) :

- `download_product_images.py` — télécharge les images des produits dans `frontend/public/products/`.
- `normalize_catalogue.py` — reconstruit les noms des produits au format des sites professionnels
  (idempotent ; relancer `npm run seed` ensuite).
- `build_showcase.py` — vitrine de l'accueil (`data/showcase.json`) et photo des tuiles de catégories
  (`data/category_covers.json`) : relancer après une modification du catalogue.
- Périphériques (`data/accessories_catalogue.json`), dans l'ordre :
  1. `python scripts/build_accessories.py --candidates` — tous les produits de `data/raw/pc-part-dataset/`
     → `data/raw/accessory_candidates.json` ;
  2. `python scripts/match_accessory_images.py --extract amazon.parquet` (une fois, nécessite `pip install duckdb`)
     puis `--subset amazon.parquet` — photos trouvées → `data/raw/accessory_images.json` ;
  3. `python scripts/build_accessories.py` — catalogue : les produits les plus populaires ayant une photo ;
  4. `python scripts/download_product_images.py --input data/accessories_catalogue.json --output-dir ../frontend/public/products --json-output data/accessories_catalogue.json`
     — photos téléchargées localement (même script que pour les composants) ;
  5. `python scripts/build_accessories.py` à nouveau, puis `npm run seed` et `npm run seed:stock`.

## Modules

| Module         | Routes                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `auth`         | `/auth/register`, `/login`, `/forgot-password`, `/reset-password`, `/me`, `/profile`                                     |
| `catalog`      | `/categories`, `/categories/covers`, `/brands`, `/products`, `/products/showcase`, `/products/:slug`                     |
| `configurator` | `/configurator/parts`, `/configurator/check`, `/configurator/suggestions` ; `/configurations` (connecté)                 |
| `cart`         | `/cart`, `/cart/items/:id` (connecté)                                                                                    |
| `order`        | `/orders`, `/orders/:id`, `/orders/:id/cancel`, `/orders/checkout`, `/orders/addresses[/:id[/default]]` (connecté)       |
| `admin`        | `/admin/dashboard?days=7\|30\|90\|365`, `/admin/orders`, `/admin/products/stock`, `/admin/stock/movements`… (rôle ADMIN) |
| —              | `/health`                                                                                                                |

Les messages renvoyés suivent l'en-tête `Accept-Language` (`fr` par défaut, `en`) : voir `src/common/i18n.ts`.

## Documentation et validation

- **Swagger** : `/docs` (page interactive), `/docs-json` (spécification OpenAPI). Routes groupées par module, avec
  description, paramètres, exemples et cadenas sur les routes protégées (« Authorize » avec le jeton de connexion).
- **DTO** (`*.dto.ts` de chaque module) : chaque corps de requête est une classe `class-validator` documentée pour
  Swagger. Le `ValidationPipe` global (`src/common/validation.ts`) renvoie les erreurs au format attendu par le
  site (`{ statusCode: 400, message: string[] }`), traduites, et retire les champs inconnus. Les services gardent
  leurs propres contrôles et toutes les règles métier (stock, unicité, transitions de statut).
