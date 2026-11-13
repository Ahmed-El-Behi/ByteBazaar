import { HttpErrorResponse } from '@angular/common/http';
import { HIDDEN_SPECS, SPEC_LABELS, translateSpecValue } from '../core/spec-labels';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { ProductDetail, ProductListItem } from '../core/models';
import { ConfiguratorApi } from '../core/configurator-api';
import { ToastService } from '../core/toast.service';
import { ProductCard } from '../components/product-card';
import { Icon } from '../components/icon';
import { TndPipe } from '../core/tnd.pipe';
import { CartStateService } from '../core/cart.service';
import { apiErrors } from '../core/utils';
import {
  I18nService,
  LocalNamePipe,
  ProductNamePipe,
  TPipe,
  localProductName,
  translate,
} from '../core/i18n';

type State =
  | { status: 'loading' | 'notfound' | 'error'; product: null }
  | { status: 'ok'; product: ProductDetail };

// Données structurées affichées en plus des caractéristiques de la source (celles qu'elles n'ont pas)
const TECH_EXTRAS: Record<string, string[]> = {
  cpu: ['socket'],
  motherboard: ['chipset', 'ramType'],
  gpu: ['tdpWatts'],
  pcCase: ['supportedFormFactors', 'sfxOnly'],
};

// Libellés traduits à l'affichage (core/i18n-en.ts)
// i18n
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
  sfxOnly: 'Alimentation SFX uniquement',
  // Périphériques
  screenSizeIn: 'Taille (pouces)',
  resolutionWidth: 'Résolution horizontale (px)',
  resolutionHeight: 'Résolution verticale (px)',
  refreshRateHz: 'Fréquence (Hz)',
  responseTimeMs: 'Temps de réponse (ms)',
  panelType: 'Dalle',
  aspectRatio: "Format d'image",
  wireless: 'Sans fil',
  maxDpi: 'DPI max',
  trackingMethod: 'Capteur',
  handOrientation: 'Orientation',
  tenkeyless: 'Sans pavé numérique (TKL)',
  style: 'Style',
  switches: 'Switchs',
  backlight: 'Rétroéclairage',
  microphone: 'Microphone',
  enclosureType: 'Conception',
  channels: 'Canaux',
  maxResolution: 'Résolution max',
  focusType: 'Mise au point',
  fovDegrees: 'Champ de vision (°)',
  connection: 'Connexion',
};
// /i18n

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? translate('Oui') : translate('Non');

  if (Array.isArray(value)) {
    return value.map((v) => String(v).replaceAll('_', ' ')).join(', ');
  }

  return String(value).replaceAll('_', ' ');
}

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, TndPipe, TPipe, LocalNamePipe, ProductNamePipe, ProductCard, Icon],
  template: `
    <div class="container page">
      @if (state().product; as p) {
        <nav class="crumbs muted">
          <a routerLink="/produits">{{ 'Catalogue' | t }}</a> ›
          <a routerLink="/produits" [queryParams]="{ category: p.category.slug }">
            {{ p.category | localName }}
          </a>
          › {{ p.name | productName }}
        </nav>

        <div class="main">
          <div class="card ph">
            @if (p.images.length) {
              <img [src]="p.images[0].url" [alt]="p.images[0].altText ?? p.name | productName" />
            } @else {
              <span>{{ p.brand.name }}</span>
            }
          </div>

          <div class="info">
            <small class="muted"> {{ p.brand.name }} · {{ 'Réf.' | t }} {{ p.sku }} </small>

            <h1>{{ p.name | productName }}</h1>

            <p class="desc">{{ description(p) }}</p>

            <div class="buy card">
              <strong class="price">{{ p.price | tnd }}</strong>

              <span class="badge" [class.ok]="p.isAvailable">
                {{ (p.isAvailable ? 'En stock' : 'Rupture de stock') | t }}
              </span>

              <button
                class="btn primary"
                [disabled]="!p.isAvailable || adding()"
                (click)="addToCart(p)"
              >
                <app-icon name="cart" [size]="17" [stroke]="2.2" />
                {{ (adding() ? 'Ajout...' : 'Ajouter au panier') | t }}
              </button>
            </div>

            @if (errorMsg()) {
              <p class="badge" style="margin-top:0.8rem; display:inline-block;">{{ errorMsg() }}</p>
            }
          </div>
        </div>

        <!-- Vente additionnelle : pièces compatibles, affichées après l'ajout au panier -->
        @if (suggestions(); as list) {
          <section class="upsell">
            <div class="upsell-head">
              <span class="upsell-icon"><app-icon name="sparkles" [size]="20" /></span>
              <div>
                <h2>{{ 'Complétez votre achat' | t }}</h2>
                <p class="muted">
                  {{
                    'Des pièces compatibles avec ce produit, parmi les plus appréciées et en stock.'
                      | t
                  }}
                </p>
              </div>
            </div>
            @if (list.length) {
              <div class="grid-products upsell-grid">
                @for (s of list; track s.id) {
                  <app-product-card [product]="s" />
                }
              </div>
              <div class="upsell-foot">
                <a routerLink="/produits" class="btn">
                  {{ 'Voir tout le catalogue' | t }}
                  <app-icon name="arrowRight" [size]="16" [stroke]="2.2" />
                </a>
              </div>
            } @else if (suggestionsLoading()) {
              <div class="grid-products upsell-grid">
                @for (i of [0, 1, 2, 3]; track i) {
                  <div class="card sk-card">
                    <div class="skeleton sk-img"></div>
                    <div class="skeleton sk-line"></div>
                    <div class="skeleton sk-line short"></div>
                  </div>
                }
              </div>
            }
          </section>
        }

        @if (techRows().length || specRows().length) {
          <section class="card specs">
            <h2>{{ 'Caractéristiques' | t }}</h2>

            <table>
              @for (r of techRows(); track r.label) {
                <tr>
                  <th>{{ r.label }}</th>
                  <td>{{ r.value }}</td>
                </tr>
              }

              @for (s of specRows(); track s.id) {
                <tr>
                  <th>{{ s.label }}</th>
                  <td>{{ s.value }}</td>
                </tr>
              }
            </table>
          </section>
        }
      } @else if (state().status === 'notfound') {
        <p class="card empty">
          {{ "Ce produit n'existe pas." | t }}
          <a routerLink="/produits">
            <u>{{ 'Retour au catalogue' | t }}</u>
          </a>
        </p>
      } @else if (state().status === 'error') {
        <p class="card empty">
          {{ 'Impossible de joindre le serveur. Le backend est-il lancé ?' | t }}
        </p>
      } @else {
        <p class="muted">{{ 'Chargement…' | t }}</p>
      }
    </div>
  `,

  styles: `
    .page {
      padding-block: 1.5rem;
    }

    .crumbs {
      font-size: var(--fs-md);
      margin-bottom: 1.2rem;
    }

    .crumbs a:hover {
      color: var(--accent);
    }

    .main {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 2rem;
      align-items: start;
    }

    .ph {
      width: 100%;
      max-width: 380px;
      height: 340px;
      margin-inline: auto;
      padding: 16px;

      display: flex;
      align-items: center;
      justify-content: center;

      overflow: hidden;
      border-radius: 36px;
      background: var(--ph-bg);
      box-sizing: border-box;
    }

    .ph img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center center;
      mix-blend-mode: multiply;
    }

    .info {
      min-width: 0;
      padding-top: 0.3rem;
    }

    h1 {
      font-size: var(--fs-3xl);
      line-height: 1.25;
      margin: 0.5rem 0 0.8rem;
    }

    .desc {
      color: var(--muted);
      line-height: 1.7;
    }

    .buy {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.2rem;
      margin-top: 1.2rem;
      border-radius: 999px;
      padding: 0.8rem 0.8rem 0.8rem 1.6rem;
    }

    .price {
      font-size: var(--fs-3xl);
      color: var(--accent);
      margin-right: auto;
    }

    .buy .btn.primary {
      padding: 0.8rem 1.4rem;
    }

    .upsell {
      margin-top: 2rem;
      padding: 1.4rem;
      border-radius: var(--r-xl);
      border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
      background:
        radial-gradient(
          500px circle at 0% 0%,
          color-mix(in srgb, var(--accent) 9%, transparent),
          transparent 60%
        ),
        radial-gradient(
          400px circle at 100% 100%,
          color-mix(in srgb, var(--pink) 7%, transparent),
          transparent 60%
        ),
        var(--card-bg);
      box-shadow: var(--shadow);
      animation: upsell-in 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    @keyframes upsell-in {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
    }
    .upsell-head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      margin-bottom: 1.1rem;
    }
    .upsell-head h2 {
      margin: 0;
      font-size: var(--fs-xl);
    }
    .upsell-head p {
      margin: 0.15rem 0 0;
      font-size: var(--fs-sm);
    }
    .upsell-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), var(--pink));
      color: #fff;
      box-shadow: 0 10px 20px -10px color-mix(in srgb, var(--pink) 70%, transparent);
    }
    /* 3 colonnes : deux propositions par type de pièce */
    .upsell-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    @media (max-width: 800px) {
      .upsell-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 480px) {
      .upsell-grid {
        grid-template-columns: 1fr;
      }
    }
    .upsell-foot {
      display: flex;
      justify-content: center;
      margin-top: 1.3rem;
    }
    .sk-card {
      padding: 0.6rem;
    }
    .sk-img {
      aspect-ratio: 4 / 3;
      border-radius: var(--r-xl);
    }
    .sk-line {
      height: 14px;
      border-radius: 6px;
      margin: 1rem 0.5rem 0;
    }
    .sk-line.short {
      width: 45%;
      margin-bottom: 0.8rem;
    }

    .specs {
      margin-top: 2rem;
      padding: 1.2rem 1.4rem;
      border-radius: var(--r-xl);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      text-align: left;
      padding: 0.55rem 0;
      border-bottom: 1px solid var(--border);
    }

    th {
      width: 45%;
      color: var(--muted);
      font-weight: 600;
    }

    .empty {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
    }

    @media (max-width: 800px) {
      .main {
        grid-template-columns: 1fr;
        gap: 1.2rem;
      }

      .ph {
        max-width: 340px;
        height: 290px;
      }

      .info {
        padding-top: 0;
      }

      h1 {
        font-size: var(--fs-2xl);
      }

      .buy {
        padding: 1rem;
      }
    }

    @media (max-width: 480px) {
      .ph {
        max-width: 300px;
        height: 260px;
      }

      .price {
        font-size: var(--fs-2xl);
      }
    }
  `,
})
export class ProductDetailPage {
  private api = inject(CatalogApi);
  private cartState = inject(CartStateService);
  private configuratorApi = inject(ConfiguratorApi);
  private toast = inject(ToastService);
  readonly i18n = inject(I18nService);

  slug = input.required<string>();

  adding = signal(false);
  /** Pièces compatibles proposées après l'ajout au panier (null : pas encore demandées) */
  readonly suggestions = signal<ProductListItem[] | null>(null);
  readonly suggestionsLoading = signal(false);
  private suggestionsFor: number | null = null;
  errorMsg = signal<string | null>(null);

  readonly state = toSignal<State, State>(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.api.product(slug).pipe(
          map((product): State => ({
            status: 'ok',
            product,
          })),
          catchError((e: HttpErrorResponse) =>
            of<State>({
              status: e.status === 404 ? 'notfound' : 'error',
              product: null,
            }),
          ),
          startWith<State>({
            status: 'loading',
            product: null,
          }),
        ),
      ),
    ),
    {
      initialValue: {
        status: 'loading',
        product: null,
      },
    },
  );

  constructor() {
    effect(() => {
      this.slug();
      this.suggestions.set(null);
      this.suggestionsFor = null;
      this.errorMsg.set(null);
    });
  }

  /** Caractéristiques de la source, traduites (sans doublon avec les données structurées). */
  readonly specRows = computed(() => {
    // Les caractéristiques de la source sont en anglais : traduites en français, telles quelles en anglais
    const english = this.i18n.lang() === 'en';
    return (this.state().product?.specs ?? [])
      .filter((s) => !HIDDEN_SPECS.has(s.name))
      .map((s) =>
        english
          ? { id: s.id, label: s.name, value: s.valueText }
          : {
              id: s.id,
              label: SPEC_LABELS[s.name] ?? s.name,
              value: translateSpecValue(s.valueText),
            },
      );
  });

  readonly techRows = computed(() => {
    const technical = this.state().product?.technical;
    this.i18n.lang(); // libellés et Oui / Non selon la langue

    if (!technical) return [];

    const extras = TECH_EXTRAS[String(technical['kind'])] ?? [];
    return Object.entries(technical)
      .filter(([key, value]) => extras.includes(key) && value !== null && value !== undefined)
      .map(([key, value]) => ({
        label:
          technical['kind'] === 'gpu' && key === 'tdpWatts'
            ? this.i18n.t('Consommation (W)')
            : this.i18n.t(LABELS[key] ?? key),
        value: formatValue(value),
      }));
  });

  /** Description dans la langue choisie (le nom du produit qu'elle cite garde sa couleur traduite) */
  description(p: ProductDetail): string {
    if (this.i18n.lang() !== 'en' || !p.descriptionEn) return p.descriptionFr;
    return p.descriptionEn.split(p.name).join(localProductName(p.name, 'en'));
  }

  /** Charge (une fois par produit) les pièces compatibles à proposer, puis les fait apparaître */
  private loadSuggestions(productId: number) {
    if (this.suggestionsFor === productId) return;
    this.suggestionsFor = productId;
    this.suggestionsLoading.set(true);
    this.suggestions.set([]);
    this.configuratorApi.suggestions(productId).subscribe({
      next: (list) => {
        if (this.suggestionsFor !== productId) return;
        this.suggestionsLoading.set(false);
        this.suggestions.set(list.length ? list : null);
        setTimeout(
          () =>
            document
              .querySelector('.upsell')
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
          80,
        );
      },
      error: () => {
        this.suggestionsLoading.set(false);
        this.suggestions.set(null);
      },
    });
  }

  addToCart(p: ProductDetail) {
    this.adding.set(true);
    this.errorMsg.set(null);

    const product = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      stockQuantity: p.stockQuantity,
      image: p.images[0] ? { url: p.images[0].url, altText: p.images[0].altText } : null,
    };

    this.cartState.addItem(product, 1).subscribe({
      next: () => {
        this.adding.set(false);
        this.toast.added(p.name, product.image?.url);
        this.loadSuggestions(p.id);
      },
      error: (e) => {
        this.adding.set(false);
        this.errorMsg.set(apiErrors(e)[0]);
      },
    });
  }
}
