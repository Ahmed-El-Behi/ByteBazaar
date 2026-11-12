# ByteBazaar — API (NestJS)

Voir le [README principal](../README.md) pour l'installation complète.

| Script               | Rôle                                                        |
| -------------------- | ----------------------------------------------------------- |
| `npm run start:dev`  | API en mode développement (rechargement automatique)       |
| `npm run seed`       | Synchronise le catalogue depuis `data/catalogue_local_images_cleaned.json` |
| `npm run seed:stock` | Stock de test reproductible pour les produits à 0          |
| `npm test`           | Tests unitaires                                             |
| `npm run test:e2e`   | Tests d'intégration (base de développement requise)        |
| `npm run lint`       | oxlint                                                      |

Scripts de données (`scripts/`) :

- `download_product_images.py` — télécharge les images des produits dans `frontend/public/products/`.
- `normalize_catalogue.py` — reconstruit les noms des produits au format des sites professionnels
  (idempotent ; relancer `npm run seed` ensuite).
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

| Module    | Routes                                                              |
| --------- | ------------------------------------------------------------------- |
| `auth`    | `/auth/register`, `/login`, `/forgot-password`, `/reset-password`, `/me`, `/profile` |
| `catalog` | `/categories`, `/brands`, `/products` (filtres, recherche, tri), `/products/:slug` |
| `cart`    | `/cart` (connecté)                                                  |
| `order`   | `/orders`, `/orders/addresses`, `/orders/checkout`, `/orders/:id` (connecté) |
| `admin`   | `/admin/orders`, `/admin/products/stock`, `/admin/stock/movements`… (rôle ADMIN) |
| —         | `/health`                                                           |
