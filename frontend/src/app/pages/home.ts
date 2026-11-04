import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { CategoryNode, Paginated, ProductListItem } from '../core/models';
import { ProductCard } from '../components/product-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  template: `
    <section class="hero">
      <div class="container">
        <p class="eyebrow">Composants PC · Tunisie</p>
        <h1>Le bazar des <span>composants PC</span> en Tunisie</h1>
        <p class="lead">
          Un très large choix multi-marques, des prix clairs en TND et, bientôt, un configurateur
          qui garantit des assemblages compatibles.
        </p>
        <a class="btn primary" routerLink="/produits">Voir le catalogue</a>
      </div>
    </section>

    <section class="container section">
      <h2>Parcourir par catégorie</h2>
      <div class="tiles">
        @for (c of tiles(); track c.id) {
          <a class="card tile" routerLink="/produits" [queryParams]="{ category: c.slug }">
            <span class="icon" aria-hidden="true">{{ icon(c.slug) }}</span>
            <span class="txt">
              <strong>{{ c.nameFr }}</strong>
              <small class="muted">{{ c._count.products }} {{ c._count.products > 1 ? 'produits' : 'produit' }}</small>
            </span>
          </a>
        }
      </div>
    </section>

    <section class="container section">
      <h2>Derniers ajouts</h2>
      @if (latest(); as l) {
        <div class="grid-products">
          @for (p of l.data; track p.id) {
            <app-product-card [product]="p" />
          }
        </div>
      } @else {
        <p class="muted">Chargement…</p>
      }
    </section>
  `,
  styles: `
    .hero { position: relative; overflow: hidden; width: min(1200px, 100% - 2rem); margin: 1.5rem auto 0; padding: 4.5rem 3rem; border-radius: 40px; color: var(--hero-ink); background: var(--hero-bg); }
    .hero::after { content: ''; position: absolute; right: -90px; top: -90px; width: 340px; height: 340px; border-radius: 50%; background: var(--hero-circle); }
    .hero .container { position: relative; z-index: 1; width: 100%; margin: 0; }
    .eyebrow { display: inline-block; padding: 0.3rem 0.9rem; border-radius: 999px; background: var(--hero-chip); font-weight: 600; font-size: 0.85rem; margin: 0 0 1rem; }
    h1 { font-size: clamp(2rem, 5vw, 3.2rem); max-width: 18ch; }
    h1 span { color: inherit; }
    .lead { color: var(--hero-lead); max-width: 56ch; margin-bottom: 1.8rem; }
    .hero .btn.primary { background: var(--hero-btn-bg); color: var(--hero-btn-ink); border-color: var(--hero-btn-bg); }
    .tiles { display: grid; gap: 0.9rem; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .tile { padding: 0.9rem 1.1rem; border-radius: 26px; display: flex; align-items: center; gap: 0.9rem; transition: border-color 0.15s, box-shadow 0.2s; }
    .icon { flex: none; width: 52px; height: 52px; display: grid; place-items: center; font-size: 1.5rem; border-radius: 18px; background: var(--accent-soft); }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .tile:hover { border-color: var(--accent); box-shadow: var(--shadow-lift); }
  `,
})
export class HomePage {
  private api = inject(CatalogApi);

  private categories = toSignal(
    this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    { initialValue: [] as CategoryNode[] },
  );
  // Toutes les vraies catégories (feuilles) qui contiennent des produits, les plus fournies d'abord
  readonly tiles = computed(() =>
    this.categories()
      .flatMap((root) => (root.children.length ? root.children : [root]))
      .filter((c) => c._count.products > 0)
      .sort((a, b) => b._count.products - a._count.products),
  );

  private readonly icons: Record<string, string> = {
    processeurs: '🧠',
    refroidissement: '❄️',
    'cartes-meres': '🔌',
    'memoire-ram': '🧩',
    stockage: '💾',
    'cartes-graphiques': '🎮',
    alimentations: '⚡',
    boitiers: '🗄️',
    souris: '🖱️',
    claviers: '⌨️',
    ecrans: '🖥️',
  };

  icon(slug: string) {
    return this.icons[slug] ?? '🛠️';
  }

  readonly latest = toSignal<Paginated<ProductListItem> | null>(
    this.api.products({ limit: '4' }).pipe(catchError(() => of(null))),
    { initialValue: null },
  );
}