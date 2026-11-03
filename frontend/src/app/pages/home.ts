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
            <strong>{{ c.nameFr }}</strong>
            <small class="muted">{{ c._count.products }} produit(s)</small>
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
    .hero { padding: 4rem 0 3rem; background: radial-gradient(circle at 80% 0%, rgba(245, 158, 11, 0.15), transparent 55%); }
    .eyebrow { color: var(--cyan); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-size: 0.8rem; }
    h1 { font-size: clamp(2rem, 5vw, 3.2rem); max-width: 18ch; }
    h1 span { color: var(--orange); }
    .lead { color: var(--muted); max-width: 60ch; margin-bottom: 1.5rem; }
    .tiles { display: grid; gap: 0.8rem; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
    .tile { padding: 1rem; display: flex; flex-direction: column; gap: 0.2rem; transition: border-color 0.15s; }
    .tile:hover { border-color: var(--cyan); }
  `,
})
export class HomePage {
  private api = inject(CatalogApi);

  private categories = toSignal(
    this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    { initialValue: [] as CategoryNode[] },
  );
  readonly tiles = computed(() => this.categories().flatMap((root) => root.children));

  readonly latest = toSignal<Paginated<ProductListItem> | null>(
    this.api.products({ limit: '4' }).pipe(catchError(() => of(null))),
    { initialValue: null },
  );
}