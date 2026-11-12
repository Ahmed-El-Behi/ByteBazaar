# ByteBazaar

Boutique en ligne de composants PC (Tunisie, prix en TND).

| Dossier     | Technologie                                   | Port |
| ----------- | --------------------------------------------- | ---- |
| `backend/`  | NestJS 12 · Prisma 7 · PostgreSQL · Nodemailer | 3000 |
| `frontend/` | Angular 22 (composants standalone, signals)   | 4200 |

## Installation

Prérequis : Node.js 22+, PostgreSQL 16+.

```bash
# 1. Backend
cd backend
cp .env.example .env          # puis renseigner DATABASE_URL, JWT_SECRET, SMTP_*
npm install
npx prisma migrate deploy --config prisma7.config.ts
npm run seed                  # importe le catalogue (≈ 10 s, relançable)
npm run seed:stock            # stock de test reproductible (optionnel)
npm run start:dev

# 2. Frontend (autre terminal)
cd frontend
npm install
npm start                     # http://localhost:4200
```

Pour donner le rôle administrateur à un compte :

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'vous@exemple.tn';
```

## Catalogue

- Source de vérité : `backend/data/catalogue_local_images_cleaned.json` (2 997 produits, images dans `frontend/public/products/`).
- Les noms suivent le format des sites professionnels (marque + puce/modèle + capacité…). Ils sont
  générés par `backend/scripts/normalize_catalogue.py` à partir des caractéristiques ; le nom
  d'origine est conservé dans `source.originalName`.
- `npm run seed` synchronise la base avec ce fichier : création / mise à jour par SKU (le stock n'est
  jamais écrasé), suppression des produits qui n'y figurent plus (ou désactivation s'ils
  apparaissent dans une commande), suppression des catégories et marques vides.

Tri par défaut du catalogue : **Pertinence** (`backend/src/catalog/relevance.ts`) — mélange des
catégories selon la popularité de chaque produit dans sa catégorie, une part d'aléatoire qui change
chaque jour, et la disponibilité ; avec une recherche, la correspondance du texte prime.

## Tests

```bash
cd backend
npm test           # tests unitaires
npm run test:e2e   # tests d'intégration (nécessitent la base de développement)
npm run lint
```

## Sécurité

- Les routes `/admin/*` exigent un compte `ADMIN` ; le rôle est relu en base à chaque requête.
- Les liens de réinitialisation du mot de passe expirent après 15 minutes et ne servent qu'une fois ;
  une réinitialisation déconnecte les sessions existantes.
- Connexion, inscription et réinitialisation sont limitées en nombre de tentatives par adresse IP.
