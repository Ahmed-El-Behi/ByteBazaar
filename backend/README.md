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

## Modules

| Module    | Routes                                                              |
| --------- | ------------------------------------------------------------------- |
| `auth`    | `/auth/register`, `/login`, `/forgot-password`, `/reset-password`, `/me`, `/profile` |
| `catalog` | `/categories`, `/brands`, `/products` (filtres, recherche, tri), `/products/:slug` |
| `cart`    | `/cart` (connecté)                                                  |
| `order`   | `/orders`, `/orders/addresses`, `/orders/checkout`, `/orders/:id` (connecté) |
| `admin`   | `/admin/orders`, `/admin/products/stock`, `/admin/stock/movements`… (rôle ADMIN) |
| —         | `/health`                                                           |
