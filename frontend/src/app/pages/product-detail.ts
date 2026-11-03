import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { ProductDetail } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';

type State =
  | { status: 'loading' | 'notfound' | 'error'; product: null }
  | { status: 'ok'; product: ProductDetail };

const LABELS: Record<string, string> = {
  socket: 'Socket',
  cores: 'Cœurs',
  threads: 'Threads',
  baseClockGHz: 'Fréquence de base (GHz)',
  boostClockGHz: 'Fréquence boost (GHz)',
  tdpWatts: 'TDP (W)',
  hasIntegratedGraphics: 'Graphique intégré',
  chipset: 'Chipset',
  formFactor: 'Format',
  ramType: 'Type de RAM',
  ramSlots: 'Slots RAM',
  maxRamGB: 'RAM max (Go)',
  type: 'Type',
  capacityGB: 'Capacité (Go)',
  modules: 'Modules',
  speedMHz: 'Vitesse (MHz)',
  vramGB: 'VRAM (Go)',
  lengthMm: 'Longueur (mm)',
  recommendedPsuWatts: 'Alimentation recommandée (W)',
  wattage: 'Puissance (W)',
  efficiency: 'Certification',
  isModular: 'Modulaire',
  supportedFormFactors: 'Formats supportés',
  maxGpuLengthMm: 'Longueur GPU max (mm)',
};

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.map((v) => String(v).replaceAll('_', ' ')).join(', ');
  return String(value).replaceAll('_', ' ');
}

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, TndPipe],
  template: `
    <div class="container page">
      @if (state().product; as p) {
        <nav class="crumbs muted">
          <a routerLink="/produits">Catalogue</a> ›
          <a routerLink="/produits" [queryParams]="{ category: p.category.slug }">{{ p.category.nameFr }}</a> ›
          {{ p.name }}
        </nav>

        <div class="main">
          <div class="card ph">
            @if (p.images.length) {
              <img [src]="p.images[0].url" [alt]="p.images[0].altText ?? p.name" />
            } @else {
              <span>{{ p.brand.name }}</span>
            }
          </div>

          <div class="info">
            <small class="muted">{{ p.brand.name }} · Réf. {{ p.sku }}</small>
            <h1>{{ p.name }}</h1>
            <p class="desc">{{ p.descriptionFr }}</p>
            <div class="buy card">
              <strong class="price">{{ p.price | tnd }}</strong>
              <span class="badge" [class.ok]="p.isAvailable">
                {{ p.isAvailable ? 'En stock (' + p.stockQuantity + ')' : 'Rupture de stock' }}
              </span>
              <button class="btn primary" disabled title="Bientôt disponible">Ajouter au panier</button>
            </div>
          </div>
        </div>

        @if (techRows().length || p.specs.length) {
          <section class="card specs">
            <h2>Caractéristiques</h2>
            <table>
              @for (r of techRows(); track r.label) {
                <tr><th>{{ r.label }}</th><td>{{ r.value }}</td></tr>
              }
              @for (s of p.specs; track s.id) {
                <tr><th>{{ s.name }}</th><td>{{ s.valueText }}</td></tr>
              }
            </table>
          </section>
        }
      } @else if (state().status === 'notfound') {
        <p class="card empty">Ce produit n'existe pas. <a routerLink="/produits"><u>Retour au catalogue</u></a></p>
      } @else if (state().status === 'error') {
        <p class="card empty">Impossible de joindre le serveur. Le backend est-il lancé ?</p>
      } @else {
        <p class="muted">Chargement…</p>
      }
    </div>
  `,
  styles: `
    .page { padding-block: 1.5rem; }
    .crumbs { font-size: 0.9rem; margin-bottom: 1rem; }
    .crumbs a:hover { color: var(--orange); }
    .main { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; }
    .ph { aspect-ratio: 1 / 1; font-size: 2rem; }
    h1 { font-size: 1.9rem; margin: 0.3rem 0 0.8rem; }
    .desc { color: var(--muted); }
    .buy { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 1rem 1.2rem; margin-top: 1.2rem; }
    .price { font-size: 1.7rem; color: var(--orange); margin-right: auto; }
    .specs { margin-top: 2rem; padding: 1.2rem 1.4rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.55rem 0; border-bottom: 1px solid var(--border); }
    th { width: 45%; color: var(--muted); font-weight: 600; }
    .empty { padding: 2rem; text-align: center; color: var(--muted); }
    @media (max-width: 800px) { .main { grid-template-columns: 1fr; } }
  `,
})
export class ProductDetailPage {
  private api = inject(CatalogApi);

  // Alimenté par l'URL /produits/:slug grâce à withComponentInputBinding()
  slug = input.required<string>();

  readonly state = toSignal<State, State>(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.api.product(slug).pipe(
          map((product): State => ({ status: 'ok', product })),
          catchError((e: HttpErrorResponse) =>
            of<State>({ status: e.status === 404 ? 'notfound' : 'error', product: null }),
          ),
          startWith<State>({ status: 'loading', product: null }),
        ),
      ),
    ),
    { initialValue: { status: 'loading', product: null } },
  );

  readonly techRows = computed(() => {
    const technical = this.state().product?.technical;
    if (!technical) return [];
    return Object.entries(technical)
      .filter(([key, value]) => key !== 'kind' && value !== null && value !== undefined)
      .map(([key, value]) => ({ label: LABELS[key] ?? key, value: formatValue(value) }));
  });
}