# ByteBazaar

Boutique en ligne de composants PC et de périphériques pour la Tunisie (prix en TND), en français et en anglais.

| Dossier     | Technologie                                                     | Port |
| ----------- | --------------------------------------------------------------- | ---- |
| `backend/`  | NestJS 12 · Prisma 7 · PostgreSQL · Nodemailer                  | 3000 |
| `frontend/` | Angular 22 (composants standalone, signals) · Three.js · Lucide | 4200 |

## Fonctionnalités

- Catalogue de près de 3 900 produits : filtres (catégorie, marque, prix, stock), recherche, tri par pertinence.
- Configurateur PC 3D : seules les pièces compatibles sont proposées (socket, type de mémoire, format, puissance).
- Panier invité ou connecté, commande (paiement à la livraison, virement, carte, PayPal), suivi des commandes.
- Fiche produit avec suggestions de pièces compatibles après l'ajout au panier.
- Espace client (profil, adresses, commandes, configurations enregistrées) et administration (commandes, stock).
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
npm run start:dev

# 2. Site (autre terminal)
cd frontend
npm install
npm start                     # http://localhost:4200
```

Pour donner le rôle administrateur à un compte :

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'vous@exemple.tn';
```

## Mise en production

- API : `npm run build` puis `npm run start:prod` (variables de `backend/.env.example`, `FRONTEND_URL` = domaine du site).
- Site : renseigner l'URL publique de l'API dans `frontend/src/environments/environment.ts`, puis `npm run build`
  et servir `frontend/dist/frontend/browser` (toutes les routes inconnues renvoient vers `index.html`).
- Compléter l'identification légale du vendeur dans `frontend/src/app/core/legal-content.ts`.

## Vérifications

```bash
cd backend && npm run lint && npm test && npm run test:e2e   # test:e2e : base de développement requise
cd frontend && npm run typecheck && npm run i18n:check && npm run format:check && npm test && npm run build
```

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
