# CLAUDE.md — ByteBazaar

Online PC-parts store for Tunisia (prices in TND). UI, routes, commit messages and code comments are in **French**.
See `README.md` (setup, catalogue, security) and `backend/README.md` (data pipelines) for details.

## Stack

| Folder      | Tech                                                                 | Port |
| ----------- | -------------------------------------------------------------------- | ---- |
| `backend/`  | NestJS 12 · Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`) · PostgreSQL · Nodemailer | 3000 |
| `frontend/` | Angular 22 (standalone components, signals) · Three.js 0.186 · lucide (vanilla) | 4200 |

- Prisma config is `backend/prisma7.config.ts` → always pass `--config prisma7.config.ts` to Prisma CLI commands.
  Generated client lives in `backend/src/generated/prisma`.
- Env vars (`backend/.env`, template `.env.example`): `DATABASE_URL, JWT_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FRONTEND_URL, PORT`.
- Windows dev machine; `pg_dump` is at `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe`. DB backups in `backend/backups/`.

## Commands

```bash
# backend
npm run start:dev            # API in watch mode
npm run seed                 # sync DB with both catalogue JSON files (idempotent, never overwrites stock)
npm run seed:stock           # reproducible test stock
npm test                     # unit tests (jest, ESM)   — 28+ tests, must pass
npm run test:e2e             # needs dev DB
npm run lint                 # oxlint — must be 0 warnings
npx tsc --noEmit -p tsconfig.json
npx prisma migrate deploy --config prisma7.config.ts

# frontend
npm start                    # ng serve
npx ng build                 # production build — must succeed
```

**Working conventions**
- The user usually runs `ng serve` (4200) and the API in watch mode (3000) themselves — don't start servers on those ports; reuse them for browser checks.
- Commit / push only when the user asks. Work branch: `chore/nettoyage-catalogue-securite` (pushed to `origin`, no PR to `main` yet). Commit messages in French, conventional prefix (`feat:`, `chore:`…).
- Don't leave test data in the user's browser (e.g. the configurator build in `localStorage['bytebazaar_configurator']` — stash & restore it).
- On Windows, bash heredocs mangle backslashes in Python/regex/JSON content — use the Write/Edit tools for such files.
- `prisma migrate dev --create-only` here may apply the migration and create a duplicate empty one — check `prisma/migrations/` afterwards.

## Architecture

### Backend (`backend/src`)
- `auth/` JWT auth, roles (`ADMIN` re-read from DB every request), password reset (15 min, single use, logs out sessions), rate-limit guard in `common/`.
- `catalog/` product list/detail, filters, sort; default sort **Pertinence** = `relevance.ts` (per-category popularity, daily-seeded randomness, availability; text match wins when searching).
- `cart/`, `order/` (statuses, PayPal/other payment methods, status-change e-mails via `mail/` + Handlebars templates), `admin/` (stock + orders).
- `configurator/`
  - `compatibility.ts` — **pure functions**, unit-tested. `CORE_SLOTS = cpu, motherboard, ram, gpu, storage, psu, case`; `OPTIONAL_SLOTS = cooler, monitor, keyboard, mouse, headset`. Checks: CPU↔motherboard socket, RAM DDR type ↔ motherboard, form factor ↔ case, GPU length, PSU wattage, cooling (missing cooler = *warning* only). A build is `complete` when all core slots are filled, no error/pending, and the only warnings are `cooling`. Peripherals never affect compatibility.
  - `configurator.service.ts` — `GET /configurator/parts?slot=&…selection` returns only parts compatible with the current selection (e.g. choosing a motherboard narrows CPUs to its socket, RAM to its DDR); `GET /configurator/check`; saved configurations CRUD under `/configurations`. Cooler info (`liquid`, `radiatorMm`) is derived from the "Radiator Size" spec or "AIO" in the name.
- `prisma/hardware.ts` — extracts structured hardware rows (`Cpu`, `Motherboard`, `Ram`, `Gpu`, `PowerSupply`, `PcCase`, `Monitor`, `Mouse`, `Keyboard`, `Headset`, `Speaker`, `Webcam`) from product specs; called by `seed.ts`.

### Data / catalogue (`backend/data`, `backend/scripts`)
- Sources of truth: `catalogue_local_images_cleaned.json` (≈3 000 components) + `accessories_catalogue.json` (894 peripherals). `seed.ts` merges both.
- Names are normalised to professional-retailer format by `scripts/normalize_catalogue.py` (original kept in `source.originalName`).
- Peripherals: `scripts/build_accessories.py` from `data/raw/pc-part-dataset/` (docyx/pc-part-dataset, MIT); photos matched strictly (brand + exact model + colour) by `scripts/match_accessory_images.py` against Amazon Reviews 2023 metadata (DuckDB), result in `data/raw/accessory_images.json`, downloaded by `download_product_images.py`. Only products with a photo are sold. Amazon dataset has no declared licence → educational use.
- Home hero showcase: `scripts/build_showcase.py` scores every local photo (resolution, white background, framing, contrast; monitors: bottom corners + colourful screen) and keeps the 15 most-reviewed products per featured category in `data/showcase.json`. `GET /products/showcase` draws 3 in-stock products from 3 different categories on each call (weights in `SHOWCASE_WEIGHTS`: GPU/monitors/keyboards/CPU/RAM first; never webcams or speakers). Re-run the script after changing the catalogue.
- Product images are local: `frontend/public/products/<category>/<SKU>.jpg` (accessories: `ACC-*.jpg` in `ecrans/ claviers/ souris/ casques/ enceintes/ webcams/`).

### Frontend (`frontend/src/app`)
- `core/` API services, guards, interceptor, `theme.service.ts` (light/dark), `tnd.pipe.ts`, `spec-labels.ts` (French labels for specs).
- `components/icon.ts` — `<app-icon name="…">` renders Lucide icons; use it for every icon (no emoji / hand-drawn SVG).
- Design tokens in `src/styles.css`: surfaces `--bg < --surface < --surface-2 < --surface-3`, `--text/--text-2/--muted`, `--accent`, `--font-display` + `--font-body`, scale `--fs-2xs … --fs-5xl`, radii `--r-*`, shadows `--shadow*`. Reuse tokens, don't hard-code colours/sizes.
- Routes are French (`/produits`, `/configurateur` (lazy), `/panier`, `/checkout`, `/compte/...`, `/admin/commandes`, `/admin/stock`).

### Languages (FR default / EN) — every user-facing text must exist in both
- Header toggle (`app.html`, `.lang-switch`) → `I18nService` (`core/i18n.ts`), saved in `localStorage['bytebazaar_lang']`, sets `<html lang>`.
- **Frontend**: texts stay written in French; the French text is the key. Templates: `{{ 'Texte' | t }}`, params `{{ '{n} produits' | t: { n: x } }}`, attributes `[title]="'Texte' | t"` (apostrophe in an attribute → `&quot;L'article&quot; | t`). Code: `translate('Texte')` / `i18n.t()`. English in `core/i18n-en.ts` (British English).
- Lists of labels kept in French (status maps, sort options…) are wrapped in `// i18n` … `// /i18n` comments and translated at display; signal values set in French and translated in the template get `// traduit à l'affichage`.
- `| localName` for categories (API `nameFr`/`nameEn`), `| productName` for product names (translates the final colour in brackets, e.g. « (Noir) » → « (Black) »), `| tnd` follows the locale (fr-FR / en-GB). Product page: `descriptionEn` and raw English specs in EN.
- **Check after any UI change**: `node scripts/check-i18n.mjs` (from `frontend/`) — must report 0 missing / 0 param mismatch.
- **Backend**: interceptor sends `Accept-Language: fr|en`; `common/i18n.ts` middleware (AsyncLocalStorage) → use `tr('texte FR', 'English text')` for every message returned to the UI (exceptions, compatibility checks, configurator highlights). The configurator re-fetches its check when the language changes.
- Not translated (out of the website): transactional e-mails (`mail/`) are French only.

### 3D configurator (`pages/configurator.ts` + `components/`)
- `pc-scene.ts` — Three.js scene (OrbitControls, RoomEnvironment, bloom post-processing, shadows). **Two modes**:
  - `desk` (default): desk with monitor/keyboard/mouse/headset + PC. The whole PC is a single hover target `'pc'` (deliberately low hover sensitivity); hovering a peripheral shows its card, click opens its picker.
  - `pc`: clicking the PC flies the camera in (1.1 s eased tween, controls disabled during flight); each component is hoverable (pops out) and clickable. "← Vue d'ensemble" button or Escape returns to desk.
  - Per-mode camera limits in `VIEWS` (target, radius, polar/azimuth ranges, distance).
- `pc-model.ts` — builds the case and components (`Builder`, `glowMesh` for RGB, `SlotView` with pop-out axis `z`/`y`), `hitTargets(mode)`, `slotOf(object, mode)`, `anchorOf`. Cooler: air tower or AIO (pump + RGB ring, tubes, radiator under top panel sized from `radiatorMm`; top case fans removed when AIO); ghost frame when empty.
- `desk-model.ts` — desk (`DESK_Y`, `DESK_TARGET`), monitor (size/aspect from specs, RGB strip if RGB or ≥144 Hz), keyboard (full/TKL/compact, instanced keys, RGB underglow), mouse, headset on stand; cables when wired.
- `three-utils.ts` — `isWhite`, `isRgb`, `productColor` (colour from the final parenthetical of the product name), `seeded`, `canvasTexture`.
- Slot lists on the frontend: `PC_SLOTS` / `DESK_SLOTS` in `core/configurator-api.ts`; chips grouped "Unité centrale" / "Poste de travail (facultatif)".

## Status

### Done (all committed and pushed on `chore/nettoyage-catalogue-securite`)
- `903e4f3` Full repo audit & clean-up, catalogue name normalisation, "Pertinence" sort, API hardening (admin role check, rate limits, reset-password flow).
- `e119aa9` Configurator backend with compatibility filtering + interactive 3D open-side PC (RGB, high fidelity).
- `741a07e` Visual facelift (fonts, Lucide icons, colour depth); peripherals dataset in DB/Prisma/site with local photos; configurator CPU cooler slot + 3D desk setup with click-to-zoom two-level navigation.

### Remaining / ideas
- Open a PR `chore/nettoyage-catalogue-securite` → `main` (not done yet; ask first).
- Production build warning: initial bundle ≈520 kB > 500 kB budget (`frontend/angular.json`). Either raise the budget or trim (e.g. lazy-load more pages / icons). The configurator chunk (~700 kB, Three.js) is lazy and not counted.
- Speakers and webcams are in the catalogue but not in the 3D desk (only monitor/keyboard/mouse/headset).
- Configurator could add cooler compatibility checks (socket support, AIO radiator vs case top-mount size, tower height vs case clearance) — currently cooler is only "present or warning".
- Frontend has almost no unit tests (`ng test`); backend e2e tests require the dev DB.
- Amazon-sourced accessory photos: licence unclear — replace before any commercial use.
