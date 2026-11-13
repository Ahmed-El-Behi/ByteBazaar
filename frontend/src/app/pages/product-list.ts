import { Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../components/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { Brand, CategoryNode, Paginated, ProductListItem } from '../core/models';
import { ProductCard } from '../components/product-card';
import { LocalNamePipe, TPipe } from '../core/i18n';

const KEYS = ['category', 'brand', 'minPrice', 'maxPrice', 'inStock', 'sort', 'q', 'page'];

@Component({
  selector: 'app-product-list',
  imports: [Icon, ProductCard, TPipe, LocalNamePipe],
  template: `
    <div class="container layout">
      <aside class="card filters">
        <h3>{{ 'Catégories' | t }}</h3>
        <button class="link" [class.active]="!param('category')" (click)="go({ category: null })">
          {{ 'Tout le catalogue' | t }}
        </button>
        @for (root of filteredCategories(); track root.id) {
          <button class="link root" [class.active]="param('category') === root.slug" (click)="go({ category: root.slug })">
            {{ root | localName }}
            @if (!root.children.length) { <small>{{ root._count.products }}</small> }
          </button>
          @for (c of root.children; track c.id) {
            <button class="link child" [class.active]="param('category') === c.slug" (click)="go({ category: c.slug })">
              {{ c | localName }} <small>{{ c._count.products }}</small>
            </button>
          }
        }

        <h3>{{ 'Marques' | t }}</h3>
        @for (b of brands(); track b.id) {
          <label class="check">
            <input type="checkbox" [checked]="selectedBrands().includes(b.slug)" (change)="toggleBrand(b.slug)" />
            {{ b.name }}
          </label>
        }

        <h3>{{ 'Prix (TND)' | t }}</h3>
        <div class="price">
          <input #min type="number" min="0" [placeholder]="'Min' | t" [value]="param('minPrice') ?? ''" (change)="go({ minPrice: min.value || null })" />
          <input #max type="number" min="0" [placeholder]="'Max' | t" [value]="param('maxPrice') ?? ''" (change)="go({ maxPrice: max.value || null })" />
        </div>

        <label class="check">
          <input #stock type="checkbox" [checked]="param('inStock') === 'true'" (change)="go({ inStock: stock.checked ? 'true' : null })" />
          {{ 'En stock uniquement' | t }}
        </label>

        <button class="link reset" (click)="reset()">{{ 'Réinitialiser les filtres' | t }}</button>
      </aside>

      <section>
        @if (result(); as r) {
          <div class="toolbar">
            <span class="muted">
              {{ '{n} produit(s)' | t: { n: r.meta.total } }}
              @if (param('q')) { · {{ 'recherche « {q} »' | t: { q: param('q') } }} }
            </span>
            <select #sortSelect (change)="go({ sort: sortSelect.value })">
              @for (s of sorts; track s.value) {
                <option [value]="s.value" [selected]="(param('sort') ?? 'relevance') === s.value">{{ s.label | t }}</option>
              }
            </select>
          </div>

          @if (r.data.length) {
            <div class="grid-products" [class.loading]="loading()">
              @for (p of r.data; track p.id) {
                <app-product-card [product]="p" />
              }
            </div>
          } @else {
            <p class="card empty">{{ 'Aucun produit ne correspond à ces filtres.' | t }}</p>
          }

          @if (r.meta.totalPages > 1) {
            <div class="pager">
              <button class="btn" [disabled]="r.meta.page <= 1" (click)="go({ page: '' + (r.meta.page - 1) }, false)"><app-icon name="chevronLeft" [size]="16" [stroke]="2" /> {{ 'Précédent' | t }}</button>
              <span class="muted">{{ 'Page {page} / {total}' | t: { page: r.meta.page, total: r.meta.totalPages } }}</span>
              <button class="btn" [disabled]="r.meta.page >= r.meta.totalPages" (click)="go({ page: '' + (r.meta.page + 1) }, false)">{{ 'Suivant' | t }} <app-icon name="chevronRight" [size]="16" [stroke]="2" /></button>
            </div>
          }
        } @else if (loading()) {
          <p class="muted">{{ 'Chargement…' | t }}</p>
        } @else {
          <p class="card empty">{{ 'Impossible de joindre le serveur. Le backend est-il lancé ?' | t }}</p>
        }
      </section>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 260px 1fr; gap: 1.5rem; padding-block: 1.5rem; align-items: start; }
    .filters { padding: 1rem; position: sticky; top: 80px; max-height: calc(100vh - 100px); overflow-y: auto; }
    .filters h3 { font-size: var(--fs-sm); color: var(--accent); margin: 1.1rem 0 0.4rem; }
    .filters h3:first-child { margin-top: 0; }
    .link { display: flex; justify-content: space-between; width: 100%; background: none; border: 0; color: var(--muted); font: inherit; text-align: left; padding: 0.25rem 0; cursor: pointer; }
    .link:hover, .link.active { color: var(--accent); }
    .link.root { margin-top: 0.4rem; font-weight: 700; color: var(--text); }
    .link.child { padding-left: 0.9rem; }
    .reset { margin-top: 1rem; text-decoration: underline; }
    .check { display: flex; gap: 0.5rem; align-items: center; padding: 0.15rem 0; cursor: pointer; }
    .price { display: flex; gap: 0.5rem; margin-bottom: 0.6rem; }
    .price input { width: 100%; padding: 0.45rem; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg); color: var(--text); font: inherit; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
    select { width: auto; min-width: 190px; padding: 0.5rem 2.4rem 0.5rem 0.9rem; border-radius: var(--r-md); border: 1px solid var(--border); background-color: var(--surface); color: var(--text); font: inherit; }
    .loading { opacity: 0.5; transition: opacity 0.15s; }
    .empty { padding: 2rem; text-align: center; color: var(--muted); }
    .pager { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; }
    @media (max-width: 800px) {
      .layout { grid-template-columns: 1fr; }
      .filters { position: static; max-height: none; }
    }
  `,
})
export class ProductListPage {
  private api = inject(CatalogApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // i18n
  readonly sorts = [
    { value: 'relevance', label: 'Pertinence' },
    { value: 'newest', label: 'Nouveautés' },
    { value: 'price_asc', label: 'Prix croissant' },
    { value: 'price_desc', label: 'Prix décroissant' },
    { value: 'name', label: 'Nom (A → Z)' },
  ];
  // /i18n

  private params = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly loading = signal(true);

  private rawCategories = toSignal(
    this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    { initialValue: [] as CategoryNode[] },
  );

  // Le backend ne renvoie que les catégories contenant des produits en vente
  readonly filteredCategories = this.rawCategories;

  readonly brands = toSignal(
    this.api.brands().pipe(catchError(() => of([] as Brand[]))),
    { initialValue: [] as Brand[] },
  );

  readonly result = toSignal<Paginated<ProductListItem> | null>(
    toObservable(this.params).pipe(
      switchMap((p) => {
        this.loading.set(true);
        return this.api.products(this.toQuery(p)).pipe(
          catchError(() => of(null)),
          tap(() => this.loading.set(false)),
        );
      }),
    ),
    { initialValue: null },
  );

  readonly selectedBrands = computed(
    () => this.params().get('brand')?.split(',').filter(Boolean) ?? [],
  );

  param(key: string): string | null {
    return this.params().get(key);
  }

  go(changes: Record<string, string | null>, resetPage = true) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: resetPage ? { ...changes, page: null } : changes,
      queryParamsHandling: 'merge',
    });
  }

  toggleBrand(slug: string) {
    const current = this.selectedBrands();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    this.go({ brand: next.length ? next.join(',') : null });
  }

  reset() {
    this.router.navigate([], { relativeTo: this.route });
  }

  private toQuery(p: ParamMap): Record<string, string> {
    const query: Record<string, string> = {};
    for (const key of KEYS) {
      const value = p.get(key);
      if (value) query[key] = value;
    }
    return query;
  }
}