
import { HttpErrorResponse } from '@angular/common/http';
import { HIDDEN_SPECS, SPEC_LABELS, translateSpecValue } from '../core/spec-labels';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { ProductDetail } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { CartStateService } from '../core/cart.service';
import { apiErrors } from '../core/utils';

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

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';

  if (Array.isArray(value)) {
    return value.map((v) => String(v).replaceAll('_', ' ')).join(', ');
  }

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
          <a
            routerLink="/produits"
            [queryParams]="{ category: p.category.slug }"
          >
            {{ p.category.nameFr }}
          </a>
          › {{ p.name }}
        </nav>

        <div class="main">
          <div class="card ph">
            @if (p.images.length) {
              <img
                [src]="p.images[0].url"
                [alt]="p.images[0].altText ?? p.name"
              />
            } @else {
              <span>{{ p.brand.name }}</span>
            }
          </div>

          <div class="info">
            <small class="muted">
              {{ p.brand.name }} · Réf. {{ p.sku }}
            </small>

            <h1>{{ p.name }}</h1>

            <p class="desc">{{ p.descriptionFr }}</p>

            <div class="buy card">
              <strong class="price">{{ p.price | tnd }}</strong>

              <span class="badge" [class.ok]="p.isAvailable">
                {{
                  p.isAvailable ? 'En stock' : 'Rupture de stock'
                }}
              </span>

              <button
                class="btn primary"
                [disabled]="!p.isAvailable || adding()"
                (click)="addToCart(p)"
              >
                {{ adding() ? 'Ajout...' : 'Ajouter au panier' }}
              </button>
            </div>

            @if (feedbackMsg()) {
              <p
                class="badge ok"
                style="margin-top:0.8rem; display:inline-block;"
              >
                {{ feedbackMsg() }}
              </p>
            }

            @if (errorMsg()) {
              <p class="badge" style="margin-top:0.8rem; display:inline-block;">{{ errorMsg() }}</p>
            }
          </div>
        </div>

        @if (techRows().length || specRows().length) {
          <section class="card specs">
            <h2>Caractéristiques</h2>

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
          Ce produit n'existe pas.
          <a routerLink="/produits">
            <u>Retour au catalogue</u>
          </a>
        </p>
      } @else if (state().status === 'error') {
        <p class="card empty">
          Impossible de joindre le serveur. Le backend est-il lancé ?
        </p>
      } @else {
        <p class="muted">Chargement…</p>
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

    /* Organisation générale */
    .main {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 2rem;
      align-items: start;
    }

    /* Cadre de l'image */
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

    /* Image parfaitement centrée */
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

    /* Bloc prix et panier */
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

    /* Caractéristiques */
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

    /* Tablettes et mobiles */
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

  slug = input.required<string>();

  adding = signal(false);
  feedbackMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  readonly state = toSignal<State, State>(
    toObservable(this.slug).pipe(
      switchMap((slug) =>
        this.api.product(slug).pipe(
          map(
            (product): State => ({
              status: 'ok',
              product,
            }),
          ),
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

  /** Caractéristiques de la source, traduites (sans doublon avec les données structurées). */
  readonly specRows = computed(() =>
    (this.state().product?.specs ?? [])
      .filter((s) => !HIDDEN_SPECS.has(s.name))
      .map((s) => ({ id: s.id, label: SPEC_LABELS[s.name] ?? s.name, value: translateSpecValue(s.valueText) })),
  );

  readonly techRows = computed(() => {
    const technical = this.state().product?.technical;

    if (!technical) return [];

    const extras = TECH_EXTRAS[String(technical['kind'])] ?? [];
    return Object.entries(technical)
      .filter(([key, value]) => extras.includes(key) && value !== null && value !== undefined)
      .map(([key, value]) => ({
        label: (technical['kind'] === 'gpu' && key === 'tdpWatts' ? 'Consommation (W)' : LABELS[key]) ?? key,
        value: formatValue(value),
      }));
  });

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
        this.feedbackMsg.set('Produit ajouté au panier !');
        setTimeout(() => this.feedbackMsg.set(null), 3000);
      },
      error: (e) => {
        this.adding.set(false);
        this.errorMsg.set(apiErrors(e)[0]);
      },
    });
  }
}
