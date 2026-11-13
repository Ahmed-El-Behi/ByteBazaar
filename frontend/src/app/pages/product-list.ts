import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Icon } from '../components/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { Brand, CategoryNode, Paginated, ProductListItem } from '../core/models';
import { ProductCard } from '../components/product-card';
import { I18nService, LocalNamePipe, TPipe } from '../core/i18n';
import { categoryIcon } from '../core/category-icon';

const KEYS = ['category', 'brand', 'minPrice', 'maxPrice', 'inStock', 'sort', 'q', 'page'];

/** Filtre actif affiché en pastille au-dessus des produits (cliquer le retire) */
interface ActiveFilter {
  key: string;
  label: string;
  /** Libellé à traduire (sinon affiché tel quel : nom de marque, de catégorie…) */
  translate: boolean;
  params?: Record<string, string | number>;
  remove: Record<string, string | null>;
}

@Component({
  selector: 'app-product-list',
  imports: [Icon, ProductCard, TPipe, LocalNamePipe],
  template: `
    <div class="container layout">
      <button
        type="button"
        class="filters-toggle"
        (click)="filtersOpen.set(!filtersOpen())"
        [attr.aria-expanded]="filtersOpen()"
      >
        <app-icon name="filters" [size]="17" />
        {{ 'Filtres' | t }}
        @if (activeFilters().length) {
          <span class="count-dot">{{ activeFilters().length }}</span>
        }
        <app-icon
          class="toggle-chevron"
          [class.open]="filtersOpen()"
          name="chevronDown"
          [size]="16"
        />
      </button>

      <aside class="filters" [class.open]="filtersOpen()">
        <div class="filters-head">
          <span class="filters-title"
            ><app-icon name="filters" [size]="17" /> {{ 'Filtres' | t }}</span
          >
          @if (activeFilters().length) {
            <button type="button" class="clear-link" (click)="reset()">
              {{ 'Tout effacer' | t }}
            </button>
          }
        </div>

        <section class="block">
          <button
            type="button"
            class="block-head"
            (click)="toggleSection('categories')"
            [attr.aria-expanded]="!collapsed().has('categories')"
          >
            <span>{{ 'Catégories' | t }}</span>
            <app-icon
              class="block-chevron"
              [class.closed]="collapsed().has('categories')"
              name="chevronDown"
              [size]="16"
            />
          </button>
          @if (!collapsed().has('categories')) {
            <div class="cat-list">
              <button
                type="button"
                class="cat-item"
                [class.active]="!param('category')"
                (click)="go({ category: null })"
              >
                <span class="cat-icon"><app-icon name="grid" [size]="15" /></span>
                <span class="cat-name">{{ 'Tout le catalogue' | t }}</span>
              </button>
              @for (root of filteredCategories(); track root.id) {
                <button
                  type="button"
                  class="cat-item"
                  [class.active]="param('category') === root.slug"
                  (click)="go({ category: root.slug })"
                >
                  <span class="cat-icon"
                    ><app-icon [name]="categoryIcon(root.slug)" [size]="15"
                  /></span>
                  <span class="cat-name">{{ root | localName }}</span>
                  <span class="cat-count">{{
                    root.children.length ? childTotal(root) : root._count.products
                  }}</span>
                </button>
                @if (root.children.length) {
                  <div class="cat-children">
                    @for (c of root.children; track c.id) {
                      <button
                        type="button"
                        class="cat-item child"
                        [class.active]="param('category') === c.slug"
                        (click)="go({ category: c.slug })"
                      >
                        <span class="cat-icon"
                          ><app-icon [name]="categoryIcon(c.slug)" [size]="14"
                        /></span>
                        <span class="cat-name">{{ c | localName }}</span>
                        <span class="cat-count">{{ c._count.products }}</span>
                      </button>
                    }
                  </div>
                }
              }
            </div>
          }
        </section>

        <section class="block">
          <button
            type="button"
            class="block-head"
            (click)="toggleSection('price')"
            [attr.aria-expanded]="!collapsed().has('price')"
          >
            <span>{{ 'Prix (TND)' | t }}</span>
            <app-icon
              class="block-chevron"
              [class.closed]="collapsed().has('price')"
              name="chevronDown"
              [size]="16"
            />
          </button>
          @if (!collapsed().has('price')) {
            <div class="price-range">
              <label class="price-field">
                <span class="price-tag">{{ 'Min' | t }}</span>
                <input
                  #min
                  type="number"
                  min="0"
                  inputmode="numeric"
                  placeholder="0"
                  [value]="param('minPrice') ?? ''"
                  (change)="go({ minPrice: min.value || null })"
                  (keydown.enter)="min.blur()"
                />
              </label>
              <span class="price-sep">—</span>
              <label class="price-field">
                <span class="price-tag">{{ 'Max' | t }}</span>
                <input
                  #max
                  type="number"
                  min="0"
                  inputmode="numeric"
                  placeholder="∞"
                  [value]="param('maxPrice') ?? ''"
                  (change)="go({ maxPrice: max.value || null })"
                  (keydown.enter)="max.blur()"
                />
              </label>
            </div>
          }
        </section>

        <section class="block">
          <label class="switch-row">
            <span>{{ 'En stock uniquement' | t }}</span>
            <input
              #stock
              type="checkbox"
              role="switch"
              class="switch"
              [checked]="param('inStock') === 'true'"
              (change)="go({ inStock: stock.checked ? 'true' : null })"
            />
          </label>
        </section>

        <section class="block">
          <button
            type="button"
            class="block-head"
            (click)="toggleSection('brands')"
            [attr.aria-expanded]="!collapsed().has('brands')"
          >
            <span>
              {{ 'Marques' | t }}
              @if (selectedBrands().length) {
                <span class="head-badge">{{ selectedBrands().length }}</span>
              }
            </span>
            <app-icon
              class="block-chevron"
              [class.closed]="collapsed().has('brands')"
              name="chevronDown"
              [size]="16"
            />
          </button>
          @if (!collapsed().has('brands')) {
            <div class="brand-search">
              <app-icon name="search" [size]="15" />
              <input
                #brandInput
                type="search"
                [placeholder]="'Rechercher une marque…' | t"
                [value]="brandQuery()"
                (input)="brandQuery.set(brandInput.value)"
              />
            </div>
            <div class="brand-list">
              @for (b of visibleBrands(); track b.id) {
                <label class="brand-item" [class.on]="selectedBrands().includes(b.slug)">
                  <input
                    type="checkbox"
                    [checked]="selectedBrands().includes(b.slug)"
                    (change)="toggleBrand(b.slug)"
                  />
                  <span class="box"><app-icon name="check" [size]="12" [stroke]="3" /></span>
                  <span class="brand-name">{{ b.name }}</span>
                </label>
              } @empty {
                <p class="brand-empty">{{ 'Aucune marque trouvée' | t }}</p>
              }
            </div>
          }
        </section>
      </aside>

      <section class="results">
        @if (result(); as r) {
          <div class="toolbar">
            <div class="result-count">
              <strong>{{ '{n} produit(s)' | t: { n: r.meta.total } }}</strong>
              @if (param('q')) {
                <span class="muted">· {{ 'recherche « {q} »' | t: { q: param('q') } }}</span>
              }
            </div>

            <div class="sort" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="sort-trigger"
                [class.open]="sortOpen()"
                (click)="sortOpen.set(!sortOpen())"
                aria-haspopup="listbox"
                [attr.aria-expanded]="sortOpen()"
              >
                <app-icon name="sort" [size]="15" />
                <span class="sort-label">{{ 'Trier :' | t }}</span>
                <strong>{{ currentSortLabel() | t }}</strong>
                <app-icon
                  class="sort-chevron"
                  [class.open]="sortOpen()"
                  name="chevronDown"
                  [size]="15"
                  [stroke]="2"
                />
              </button>
              @if (sortOpen()) {
                <ul class="sort-menu" role="listbox">
                  @for (s of sorts; track s.value) {
                    <li>
                      <button
                        type="button"
                        role="option"
                        class="sort-option"
                        [class.selected]="currentSort() === s.value"
                        [attr.aria-selected]="currentSort() === s.value"
                        (click)="setSort(s.value)"
                      >
                        {{ s.label | t }}
                        @if (currentSort() === s.value) {
                          <app-icon name="check" [size]="15" [stroke]="2.4" />
                        }
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>

          @if (activeFilters().length) {
            <div class="chips">
              @for (f of activeFilters(); track f.key) {
                <button
                  type="button"
                  class="chip"
                  (click)="go(f.remove)"
                  [title]="'Retirer ce filtre' | t"
                >
                  {{ f.translate ? (f.label | t: f.params) : f.label }}
                  <app-icon name="close" [size]="13" [stroke]="2.4" />
                </button>
              }
              <button type="button" class="chip-clear" (click)="reset()">
                {{ 'Tout effacer' | t }}
              </button>
            </div>
          }

          @if (r.data.length) {
            <div class="grid-products" [class.loading]="loading()">
              @for (p of r.data; track p.id) {
                <app-product-card [product]="p" />
              }
            </div>
          } @else {
            <div class="card empty">
              <p>{{ 'Aucun produit ne correspond à ces filtres.' | t }}</p>
              <button type="button" class="btn small" (click)="reset()">
                {{ 'Réinitialiser les filtres' | t }}
              </button>
            </div>
          }

          @if (r.meta.totalPages > 1) {
            <div class="pager">
              <button
                class="btn"
                [disabled]="r.meta.page <= 1"
                (click)="go({ page: '' + (r.meta.page - 1) }, false)"
              >
                <app-icon name="chevronLeft" [size]="16" [stroke]="2" /> {{ 'Précédent' | t }}
              </button>
              <span class="muted">{{
                'Page {page} / {total}' | t: { page: r.meta.page, total: r.meta.totalPages }
              }}</span>
              <button
                class="btn"
                [disabled]="r.meta.page >= r.meta.totalPages"
                (click)="go({ page: '' + (r.meta.page + 1) }, false)"
              >
                {{ 'Suivant' | t }} <app-icon name="chevronRight" [size]="16" [stroke]="2" />
              </button>
            </div>
          }
        } @else if (loading()) {
          <p class="muted">{{ 'Chargement…' | t }}</p>
        } @else {
          <p class="card empty">
            {{ 'Impossible de joindre le serveur. Le backend est-il lancé ?' | t }}
          </p>
        }
      </section>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 272px 1fr;
      gap: 1.6rem;
      padding-block: 1.5rem;
      align-items: start;
    }

    .filters {
      position: sticky;
      top: 84px;
      max-height: calc(100vh - 104px);
      overflow-y: auto;
      padding: 1.1rem 1rem 1.2rem;
      border-radius: var(--r-xl);
      background: var(--card-bg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      scrollbar-gutter: stable;
    }
    .filters-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0.25rem 0.8rem;
      border-bottom: 1px solid var(--border);
    }
    .filters-title {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-display);
      font-size: var(--fs-lg);
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .filters-title app-icon {
      color: var(--accent);
    }
    .clear-link {
      background: none;
      border: 0;
      padding: 0.25rem 0.55rem;
      border-radius: 999px;
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--accent);
      transition: background 0.15s;
    }
    .clear-link:hover {
      background: var(--accent-soft);
    }

    .block {
      padding: 0.85rem 0 0.2rem;
      border-bottom: 1px solid var(--border);
    }
    .block:last-child {
      border-bottom: 0;
    }
    .block-head {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.15rem 0.25rem 0.55rem;
      background: none;
      border: 0;
      color: var(--muted);
      font-size: var(--fs-xs);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-align: left;
    }
    .block-head > span {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }
    .block-head:hover {
      color: var(--text);
    }
    .block-chevron {
      transition: transform 0.25s ease;
    }
    .block-chevron.closed {
      transform: rotate(-90deg);
    }
    .head-badge {
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: var(--fs-2xs);
      letter-spacing: 0;
    }

    .cat-list {
      display: grid;
      gap: 2px;
      padding-bottom: 0.5rem;
    }
    .cat-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.42rem 0.5rem;
      border: 0;
      border-radius: var(--r-sm);
      background: transparent;
      color: var(--text-2);
      font-size: var(--fs-md);
      font-weight: 600;
      text-align: left;
      transition:
        background 0.15s,
        color 0.15s;
    }
    .cat-item:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .cat-icon {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      flex: none;
      border-radius: 9px;
      background: var(--surface-2);
      color: var(--muted);
      transition:
        background 0.2s,
        color 0.2s,
        transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
    }
    .cat-item:hover .cat-icon {
      color: var(--accent);
      transform: scale(1.06);
    }
    .cat-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cat-count {
      flex: none;
      min-width: 2.1rem;
      padding: 0.08rem 0.45rem;
      border-radius: 999px;
      text-align: center;
      background: var(--surface-2);
      color: var(--muted);
      font-size: var(--fs-2xs);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .cat-item.active {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .cat-item.active::before {
      content: '';
      position: absolute;
      left: -1rem;
      top: 22%;
      bottom: 22%;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--accent);
    }
    .cat-item.active .cat-icon {
      background: var(--accent);
      color: var(--on-accent);
    }
    .cat-item.active .cat-count {
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent);
    }
    .cat-children {
      display: grid;
      gap: 2px;
      margin: 2px 0 2px 1.35rem;
      padding-left: 0.55rem;
      border-left: 1px dashed var(--border-strong);
    }
    .cat-item.child {
      padding-block: 0.32rem;
      font-weight: 500;
      font-size: var(--fs-sm);
    }
    .cat-item.child .cat-icon {
      width: 24px;
      height: 24px;
      border-radius: 7px;
    }
    .cat-item.child.active::before {
      display: none;
    }

    .price-range {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0 0.15rem 0.8rem;
    }
    .price-sep {
      color: var(--muted);
      flex: none;
    }
    .price-field {
      position: relative;
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 0.35rem 0.7rem 0.4rem;
      border-radius: var(--r-md);
      border: 1px solid var(--border);
      background: var(--input-bg);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
      cursor: text;
    }
    .price-field:hover {
      border-color: var(--border-strong);
    }
    .price-field:focus-within {
      border-color: var(--accent);
      box-shadow: var(--ring);
      background: var(--surface);
    }
    .price-tag {
      font-size: var(--fs-2xs);
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .price-field input {
      width: 100%;
      padding: 0;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      font-weight: 700;
      font-size: var(--fs-ui);
      font-variant-numeric: tabular-nums;
      -moz-appearance: textfield;
    }
    .price-field input::-webkit-outer-spin-button,
    .price-field input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      padding: 0.05rem 0.25rem 0.75rem;
      font-size: var(--fs-md);
      font-weight: 600;
      color: var(--text-2);
      cursor: pointer;
    }
    .switch {
      appearance: none;
      position: relative;
      flex: none;
      width: 40px;
      height: 23px;
      margin: 0;
      border-radius: 999px;
      background: var(--surface-3);
      border: 1px solid var(--border-strong);
      cursor: pointer;
      transition:
        background 0.2s,
        border-color 0.2s;
    }
    .switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);
    }
    .switch:checked {
      background: var(--accent);
      border-color: var(--accent);
    }
    .switch:checked::after {
      transform: translateX(17px);
    }
    .switch:focus-visible {
      outline: none;
      box-shadow: var(--ring);
    }

    .brand-search {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0.15rem 0.5rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--muted);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .brand-search:focus-within {
      border-color: var(--accent);
      box-shadow: var(--ring);
      color: var(--accent);
    }
    .brand-search input {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      font-size: var(--fs-sm);
    }
    .brand-list {
      display: grid;
      gap: 1px;
      max-height: 260px;
      overflow-y: auto;
      padding: 0 0.1rem 0.6rem;
    }
    .brand-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.36rem 0.45rem;
      border-radius: var(--r-sm);
      font-size: var(--fs-md);
      color: var(--text-2);
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
    }
    .brand-item:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .brand-item input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .box {
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      flex: none;
      border-radius: 6px;
      border: 1.5px solid var(--border-strong);
      background: var(--surface);
      color: transparent;
      transition:
        background 0.15s,
        border-color 0.15s,
        color 0.15s,
        transform 0.2s cubic-bezier(0.3, 1.6, 0.5, 1);
    }
    .brand-item:hover .box {
      border-color: var(--accent);
    }
    .brand-item.on {
      color: var(--text);
      font-weight: 600;
    }
    .brand-item.on .box {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--on-accent);
      transform: scale(1.05);
    }
    .brand-item input:focus-visible + .box {
      box-shadow: var(--ring);
    }
    .brand-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .brand-empty {
      margin: 0.3rem 0.45rem 0.6rem;
      font-size: var(--fs-sm);
      color: var(--muted);
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .result-count {
      display: flex;
      align-items: baseline;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .result-count strong {
      font-family: var(--font-display);
      font-size: var(--fs-lg);
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }

    .sort {
      position: relative;
    }
    .sort-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      height: 40px;
      padding: 0 0.95rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-sm);
      font-size: var(--fs-md);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .sort-trigger:hover,
    .sort-trigger.open {
      border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
    }
    .sort-trigger.open {
      box-shadow: var(--ring);
    }
    .sort-trigger > app-icon:first-child {
      color: var(--accent);
    }
    .sort-label {
      color: var(--muted);
    }
    .sort-chevron {
      color: var(--muted);
      transition: transform 0.25s ease;
    }
    .sort-chevron.open {
      transform: rotate(180deg);
      color: var(--accent);
    }
    .sort-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      z-index: 20;
      min-width: 230px;
      margin: 0;
      padding: 0.35rem;
      list-style: none;
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow-lift);
      transform-origin: top right;
      animation: menu-in 0.18s cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    @keyframes menu-in {
      from {
        opacity: 0;
        transform: translateY(-6px) scale(0.97);
      }
    }
    .sort-option {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      padding: 0.55rem 0.75rem;
      border: 0;
      border-radius: var(--r-sm);
      background: none;
      color: var(--text-2);
      font-size: var(--fs-md);
      font-weight: 600;
      text-align: left;
      transition:
        background 0.12s,
        color 0.12s;
    }
    .sort-option:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .sort-option.selected {
      background: var(--accent-soft);
      color: var(--accent);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem;
      margin-bottom: 1rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.32rem 0.55rem 0.32rem 0.75rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
      background: var(--accent-soft);
      color: var(--accent);
      font-size: var(--fs-sm);
      font-weight: 700;
      animation: chip-in 0.2s ease;
      transition:
        background 0.15s,
        border-color 0.15s;
    }
    .chip:hover {
      background: color-mix(in srgb, var(--accent) 20%, transparent);
      border-color: var(--accent);
    }
    .chip app-icon {
      opacity: 0.7;
      transition:
        opacity 0.15s,
        transform 0.2s;
    }
    .chip:hover app-icon {
      opacity: 1;
      transform: rotate(90deg);
    }
    @keyframes chip-in {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
    }
    .chip-clear {
      background: none;
      border: 0;
      padding: 0.3rem 0.4rem;
      color: var(--muted);
      font-size: var(--fs-sm);
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .chip-clear:hover {
      color: var(--text);
    }

    .loading {
      opacity: 0.5;
      transition: opacity 0.15s;
    }
    .empty {
      display: grid;
      justify-items: center;
      gap: 0.8rem;
      padding: 2.5rem;
      text-align: center;
      color: var(--muted);
    }
    .empty p {
      margin: 0;
    }
    .pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    /* Petits écrans : filtres repliables */
    .filters-toggle {
      display: none;
    }
    @media (max-width: 860px) {
      .layout {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
      .filters-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        justify-self: start;
        height: 42px;
        padding: 0 1rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font-weight: 700;
        box-shadow: var(--shadow-sm);
      }
      .filters-toggle > app-icon:first-child {
        color: var(--accent);
      }
      .toggle-chevron {
        transition: transform 0.25s;
      }
      .toggle-chevron.open {
        transform: rotate(180deg);
      }
      .count-dot {
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: var(--accent);
        color: var(--on-accent);
        font-size: var(--fs-2xs);
      }
      .filters {
        display: none;
        position: static;
        max-height: none;
      }
      .filters.open {
        display: block;
        animation: menu-in 0.2s ease;
      }
    }
  `,
})
export class ProductListPage {
  private api = inject(CatalogApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);

  readonly categoryIcon = categoryIcon;

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

  readonly sortOpen = signal(false);
  readonly collapsed = signal(new Set<string>());
  readonly filtersOpen = signal(false);
  readonly brandQuery = signal('');

  private rawCategories = toSignal(
    this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    { initialValue: [] as CategoryNode[] },
  );

  // Le backend ne renvoie que les catégories contenant des produits en vente
  readonly filteredCategories = this.rawCategories;

  readonly brands = toSignal(this.api.brands().pipe(catchError(() => of([] as Brand[]))), {
    initialValue: [] as Brand[],
  });

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

  /** Marques cochées en tête, puis les autres ; filtrées par la recherche */
  readonly visibleBrands = computed(() => {
    const q = this.brandQuery().trim().toLowerCase();
    const selected = new Set(this.selectedBrands());
    const list = this.brands().filter((b) => !q || b.name.toLowerCase().includes(q));
    return [
      ...list.filter((b) => selected.has(b.slug)),
      ...list.filter((b) => !selected.has(b.slug)),
    ];
  });

  readonly currentSort = computed(() => this.params().get('sort') ?? 'relevance');
  readonly currentSortLabel = computed(
    () => this.sorts.find((s) => s.value === this.currentSort())?.label ?? 'Pertinence',
  );

  /** Filtres actuellement appliqués, sous forme de pastilles */
  // i18n
  readonly activeFilters = computed<ActiveFilter[]>(() => {
    this.i18n.lang(); // noms de catégories dans la langue choisie
    const p = this.params();
    const filters: ActiveFilter[] = [];

    const category = p.get('category');
    if (category) {
      const all = this.rawCategories().flatMap((r) => [r, ...r.children]);
      const found = all.find((c) => c.slug === category);
      filters.push({
        key: 'category',
        label: found ? this.i18n.name(found) : category,
        translate: false,
        remove: { category: null },
      });
    }

    const brandNames = new Map(this.brands().map((b) => [b.slug, b.name]));
    for (const slug of this.selectedBrands()) {
      const rest = this.selectedBrands().filter((s) => s !== slug);
      filters.push({
        key: `brand:${slug}`,
        label: brandNames.get(slug) ?? slug,
        translate: false,
        remove: { brand: rest.length ? rest.join(',') : null },
      });
    }

    const min = p.get('minPrice');
    const max = p.get('maxPrice');
    if (min && max)
      filters.push({
        key: 'price',
        label: '{min} – {max} TND',
        translate: true,
        params: { min, max },
        remove: { minPrice: null, maxPrice: null },
      });
    else if (min)
      filters.push({
        key: 'price',
        label: 'Dès {min} TND',
        translate: true,
        params: { min },
        remove: { minPrice: null },
      });
    else if (max)
      filters.push({
        key: 'price',
        label: "Jusqu'à {max} TND",
        translate: true,
        params: { max },
        remove: { maxPrice: null },
      });

    if (p.get('inStock') === 'true')
      filters.push({
        key: 'stock',
        label: 'En stock uniquement',
        translate: true,
        remove: { inStock: null },
      });
    return filters;
  });
  // /i18n

  childTotal(root: CategoryNode): number {
    return root.children.reduce((sum, c) => sum + c._count.products, 0);
  }

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

  setSort(value: string) {
    this.sortOpen.set(false);
    this.go({ sort: value === 'relevance' ? null : value });
  }

  toggleSection(name: string) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  toggleBrand(slug: string) {
    const current = this.selectedBrands();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    this.go({ brand: next.length ? next.join(',') : null });
  }

  reset() {
    this.brandQuery.set('');
    this.router.navigate([], { relativeTo: this.route });
  }

  // Fermeture du menu de tri : clic ailleurs ou Échap
  @HostListener('document:click')
  closeSort() {
    this.sortOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.sortOpen.set(false);
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
