# ByteBazaar

[![CI](https://github.com/Ahmed-El-Behi/ByteBazaar/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmed-El-Behi/ByteBazaar/actions/workflows/ci.yml)

Boutique en ligne de composants PC et de périphériques pour la Tunisie (prix en TND), en français et en anglais.

| Dossier     | Technologie                                                     | Port |
| ----------- | --------------------------------------------------------------- | ---- |
| `backend/`  | NestJS 12 · Prisma 7 · PostgreSQL · Nodemailer                  | 3000 |
| `frontend/` | Angular 22 (composants standalone, signals) · Three.js · Lucide | 4200 |
| `e2e/`      | Playwright (tests de bout en bout)                              | —    |

## Fonctionnalités

- Catalogue de près de 3 900 produits : filtres (catégorie, marque, prix, stock), recherche, tri par pertinence.
- Configurateur PC 3D : seules les pièces compatibles sont proposées (socket, type de mémoire, format, puissance).
- Panier invité ou connecté, commande (paiement à la livraison, virement, carte ou PayPal simulés), e-mail de
  confirmation, suivi daté de chaque étape, annulation tant que la préparation n'a pas commencé, facture
  imprimable (TVA 19 %).
- Fiche produit avec suggestions de pièces compatibles après l'ajout au panier.
- Espace client (profil, adresses, commandes, configurations enregistrées) et administration : tableau de bord
  (chiffre d'affaires, ventes par catégorie, meilleures ventes, alertes de stock), gestion des commandes et du stock.
- Site bilingue FR / EN, thème clair / sombre, conditions générales de vente et politique de confidentialité.

## Installation

Prérequis : Node.js 22+, PostgreSQL 16+.

```bash
# 1. API
cd backend
cp .env.example .env          # renseigner DATABASE_URL, JWT_SECRET, SMTP_*, FRONTEND_URL
npm install
npx prisma migrate deploy --config prisma7.config.ts
npm run seed                  # importe le catalogue (relançable)
npm run seed:stock            # stock de test reproductible (facultatif)
npm run seed:demo-orders      # commandes de démonstration pour le tableau de bord (facultatif)
npm run start:dev

# 2. Site (autre terminal)
cd frontend
npm install
npm start                     # http://localhost:4200
```

Documentation interactive de l'API (Swagger) : http://localhost:3000/docs, ou http://localhost:4200/api/docs à
travers le site. Pour tester les routes protégées : `POST /auth/login`, puis coller le `accessToken` dans « Authorize ».

Pour donner le rôle administrateur à un compte :

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'vous@exemple.tn';
```

## Mise en production

- API : `npm run build` puis `npm run start:prod` (variables de `backend/.env.example`, `FRONTEND_URL` = domaine du site).
- Site : `npm run build`, puis servir `frontend/dist/frontend/browser` (routes inconnues → `index.html`) en relayant
  `/api/*` vers l'API (sans le préfixe), avec l'en-tête `X-Forwarded-Prefix: /api` (exemples de la documentation
  `/api/docs`). `npm run serve` le fait sur le port 4300 ; pour une API sur un autre
  domaine, mettre son URL dans `frontend/src/environments/environment.ts`.
- Compléter l'identification légale du vendeur dans `frontend/src/app/core/legal-content.ts` et ses coordonnées
  (facture, virement) dans `frontend/src/app/core/store-info.ts`.

## Vérifications

```bash
cd backend && npm run lint && npm test && npm run test:e2e   # test:e2e : base de développement requise
cd frontend && npm run typecheck && npm run i18n:check && npm run format:check && npm test && npm run build
```

### Tests de bout en bout (Playwright)

`e2e/tests/` rejoue les parcours réels dans Chrome : accueil, catalogue et recherche, panier invité, parcours client
complet (inscription → panier → commande → suivi → annulation → reconnexion), erreurs de l'API affichées et traduites,
configurateur (choix d'une pièce, pièces compatibles), langue, thème, absence de défilement horizontal sur téléphone,
Swagger, et administration (tableau de bord, commandes, stock ; accès refusé aux visiteurs).

Les tests écrivent en base (comptes `@e2e.bytebazaar.test`, commandes) : utiliser une **base de test**, pas la base de développement.

```bash
# base de test : migrations + catalogue + stock + commandes de démonstration
cd backend
DATABASE_URL=postgresql://…/bytebazaar_e2e npx prisma migrate deploy --config prisma7.config.ts
DATABASE_URL=postgresql://…/bytebazaar_e2e npm run seed && npm run seed:stock && npm run seed:demo-orders
npm run build && DATABASE_URL=postgresql://…/bytebazaar_e2e PORT=3001 node dist/main

# site (build de production, relaie /api vers l'API de test)
cd frontend && npm run build && API_TARGET=http://localhost:3001 npm run serve   # port 4300

# tests (Chrome installé en local ; E2E_ADMIN_* : un compte ADMIN de la base de test, sinon les tests admin sont ignorés)
cd e2e && npm install
E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm test          # rapport : npm run report
```

Les inscriptions sont limitées à 10 par IP et par quart d'heure : une exécution en fait 3 ; après plusieurs exécutions
d'affilée, redémarrer l'API de test (compteur en mémoire).

### Intégration continue

`.github/workflows/ci.yml`, à chaque push et pull request :

1. **backend** — oxlint, `tsc`, Prettier, tests unitaires Jest ;
2. **frontend** — `typecheck`, traductions, Prettier, tests Vitest, build de production (budget 500 kB) ;
3. **e2e** — PostgreSQL jetable, migrations et données de démonstration, tests e2e Jest de l'API, puis Playwright sur
   le build de production ; rapport HTML téléchargeable dans l'onglet *Actions* (`rapport-playwright`).

## Catalogue

- Composants : `backend/data/catalogue_local_images_cleaned.json` (noms normalisés par `scripts/normalize_catalogue.py`).
- Périphériques : `backend/data/accessories_catalogue.json`, construit à partir de
  [docyx/pc-part-dataset](https://github.com/docyx/pc-part-dataset) (PCPartPicker, licence MIT, copie dans
  `backend/data/raw/pc-part-dataset/`). Les photos proviennent de
  [Amazon Reviews 2023](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023) (McAuley Lab, sans licence
  déclarée : usage pédagogique) ; seuls les produits avec une photo sont mis en vente.
- Photos des produits : `frontend/public/products/<catégorie>/<SKU>.jpg`.
- `npm run seed` synchronise la base (création / mise à jour par SKU, stock jamais écrasé, produits retirés supprimés
  ou désactivés). Les pipelines de données sont décrits dans `backend/README.md`.

## Sécurité

- Mots de passe hachés (scrypt, sel unique) ; sessions de 7 jours révoquées après un changement de mot de passe.
- Routes `/admin/*` réservées aux comptes `ADMIN`, rôle relu en base à chaque requête.
- Liens de réinitialisation valables 15 minutes, à usage unique.
- Connexion, inscription et réinitialisation limitées en nombre de tentatives par adresse IP.
- Corps de requête validés par des DTO (`class-validator`) : types, formats et bornes vérifiés avant les services,
  champs inconnus ignorés (un client ne peut pas s'attribuer un rôle en l'ajoutant à sa requête).
