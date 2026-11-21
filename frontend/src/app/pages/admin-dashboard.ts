import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../components/admin-nav';
import { Icon } from '../components/icon';
import { RevenueChart } from '../components/revenue-chart';
import { AdminApiService, type Dashboard, type DashboardPeriod } from '../core/admin-api';
import { I18nService, LocalNamePipe, ProductNamePipe, TPipe } from '../core/i18n';
import {
  ORDER_STEPS,
  PAYMENT_LABELS,
  STATUS_LABELS,
  paymentTone,
  PAYMENT_STATUS_LABELS,
  statusTone,
  type OrderStatus,
} from '../core/orders-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

// i18n
const PERIODS: { days: DashboardPeriod; label: string }[] = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 365, label: '12 mois' },
];
// /i18n

interface Bar {
  key: string;
  label: string;
  value: number;
  figure: string;
  share: number;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    AdminNav,
    Icon,
    RevenueChart,
    RouterLink,
    DatePipe,
    NgTemplateOutlet,
    TndPipe,
    TPipe,
    LocalNamePipe,
    ProductNamePipe,
  ],
  template: `
    <div class="container page">
      <app-admin-nav />

      <header class="head">
        <div>
          <h1>{{ 'Tableau de bord' | t }}</h1>
          <p class="muted">
            {{ 'Activité de la boutique, hors commandes annulées. Montants TTC.' | t }}
          </p>
        </div>
        <div class="periods" role="radiogroup" [attr.aria-label]="'Période' | t">
          @for (p of periods; track p.days) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="days() === p.days"
              [class.on]="days() === p.days"
              (click)="load(p.days)"
            >
              {{ p.label | t }}
            </button>
          }
        </div>
      </header>

      @if (error()) {
        <p class="alert">{{ error() }}</p>
      }

      @if (data(); as d) {
        <div class="board" [class.refreshing]="loading()">
          <section class="kpis">
            <article class="card kpi hero">
              <h2>{{ "Chiffre d'affaires" | t }}</h2>
              <p class="value">{{ d.kpis.revenue | tnd }}</p>
              <ng-container
                *ngTemplateOutlet="delta; context: { $implicit: d.kpis.revenueChange }"
              />
            </article>
            <article class="card kpi">
              <h2>{{ 'Commandes' | t }}</h2>
              <p class="value">{{ d.kpis.orders }}</p>
              <ng-container
                *ngTemplateOutlet="delta; context: { $implicit: d.kpis.ordersChange }"
              />
            </article>
            <article class="card kpi">
              <h2>{{ 'Panier moyen' | t }}</h2>
              <p class="value">{{ round(d.kpis.averageBasket) | tnd }}</p>
              <ng-container
                *ngTemplateOutlet="delta; context: { $implicit: d.kpis.averageBasketChange }"
              />
            </article>
            <article class="card kpi">
              <h2>{{ 'Nouveaux clients' | t }}</h2>
              <p class="value">{{ d.kpis.newCustomers }}</p>
              <ng-container
                *ngTemplateOutlet="delta; context: { $implicit: d.kpis.newCustomersChange }"
              />
            </article>
          </section>

          <section class="actions">
            <a
              class="card action"
              routerLink="/admin/commandes"
              [queryParams]="{ filtre: 'a-traiter' }"
            >
              <span class="action-icon tone-info"><app-icon name="clock" [size]="18" /></span>
              <span>
                <strong>{{ d.kpis.toProcess }}</strong>
                <small>{{ 'Commandes à traiter' | t }}</small>
              </span>
            </a>
            <a
              class="card action"
              routerLink="/admin/commandes"
              [queryParams]="{ filtre: 'virements' }"
            >
              <span class="action-icon tone-warn"><app-icon name="bank" [size]="18" /></span>
              <span>
                <strong>{{ d.kpis.awaitingPayment }}</strong>
                <small>{{ 'Virements en attente' | t }}</small>
              </span>
            </a>
            <a class="card action" routerLink="/admin/stock">
              <span class="action-icon tone-red"><app-icon name="warning" [size]="18" /></span>
              <span>
                <strong>{{ d.kpis.outOfStock }}</strong>
                <small>{{ 'Produits en rupture' | t }}</small>
              </span>
            </a>
            <a class="card action" routerLink="/admin/stock">
              <span class="action-icon tone-warn"><app-icon name="package" [size]="18" /></span>
              <span>
                <strong>{{ d.kpis.lowStock }}</strong>
                <small>{{ 'Stock faible (1 à 3)' | t }}</small>
              </span>
            </a>
          </section>

          <section class="card panel revenue">
            <header class="panel-head">
              <div>
                <h2>{{ "Évolution du chiffre d'affaires" | t }}</h2>
                <p class="muted">
                  {{ (d.period.granularity === 'month' ? 'Par mois' : 'Par jour') | t }}
                  · {{ '{n} articles vendus' | t: { n: d.kpis.itemsSold } }}
                </p>
              </div>
            </header>
            <app-revenue-chart [points]="d.timeline" [granularity]="d.period.granularity" />
          </section>

          <div class="cols">
            <section class="card panel">
              <h2>{{ 'Commandes par statut' | t }}</h2>
              <p class="muted sub">{{ 'Commandes passées sur la période' | t }}</p>
              <ul class="bars">
                @for (b of statusBars(); track b.key) {
                  <li>
                    <span class="bar-label">{{ b.label | t }}</span>
                    <span class="track"><span class="fill" [style.width.%]="b.share"></span></span>
                    <span class="figure">{{ b.figure }}</span>
                  </li>
                }
              </ul>
            </section>

            <section class="card panel">
              <h2>{{ 'Moyens de paiement' | t }}</h2>
              <p class="muted sub">{{ 'Part des commandes' | t }}</p>
              <ul class="bars">
                @for (b of paymentBars(); track b.key) {
                  <li>
                    <span class="bar-label">{{ b.label | t }}</span>
                    <span class="track"><span class="fill" [style.width.%]="b.share"></span></span>
                    <span class="figure">{{ b.figure }}</span>
                  </li>
                } @empty {
                  <li class="none muted">{{ 'Aucune vente sur la période.' | t }}</li>
                }
              </ul>
            </section>

            <section class="card panel">
              <h2>{{ 'Ventes par catégorie' | t }}</h2>
              <p class="muted sub">{{ "Chiffre d'affaires des articles" | t }}</p>
              <ul class="bars">
                @for (c of d.categories.slice(0, 7); track c.slug) {
                  <li>
                    <span class="bar-label">{{ c | localName }}</span>
                    <span class="track"
                      ><span class="fill" [style.width.%]="share(c.revenue, maxCategory())"></span
                    ></span>
                    <span class="figure">{{ compactMoney(c.revenue, maxCategory()) }}</span>
                  </li>
                } @empty {
                  <li class="none muted">{{ 'Aucune vente sur la période.' | t }}</li>
                }
              </ul>
            </section>
          </div>

          <div class="cols two">
            <section class="card panel">
              <h2>{{ 'Meilleures ventes' | t }}</h2>
              <ol class="products">
                @for (p of d.topProducts; track p.id; let i = $index) {
                  <li>
                    <span class="rank">{{ i + 1 }}</span>
                    <span class="thumb">
                      @if (p.image) {
                        <img [src]="p.image" alt="" loading="lazy" decoding="async" />
                      }
                    </span>
                    <a class="name" [routerLink]="['/produits', p.slug]">{{
                      p.name | productName
                    }}</a>
                    <span class="nums">
                      <strong>{{ p.revenue | tnd }}</strong>
                      <small class="muted">{{ '{n} vendu(s)' | t: { n: p.quantity } }}</small>
                    </span>
                  </li>
                } @empty {
                  <li class="none muted">{{ 'Aucune vente sur la période.' | t }}</li>
                }
              </ol>
            </section>

            <section class="card panel">
              <header class="panel-head">
                <h2>{{ 'À réapprovisionner' | t }}</h2>
                <a routerLink="/admin/stock" class="link">{{ 'Gérer le stock' | t }}</a>
              </header>
              <ul class="products">
                @for (p of d.lowStock; track p.id) {
                  <li>
                    <span class="thumb">
                      @if (p.image) {
                        <img [src]="p.image" alt="" loading="lazy" decoding="async" />
                      }
                    </span>
                    <a class="name" [routerLink]="['/produits', p.slug]">{{
                      p.name | productName
                    }}</a>
                    <span class="pill" [class]="p.stockQuantity === 0 ? 'tone-red' : 'tone-warn'">
                      @if (p.stockQuantity === 0) {
                        {{ 'Rupture' | t }}
                      } @else {
                        {{ '{n} en stock' | t: { n: p.stockQuantity } }}
                      }
                    </span>
                  </li>
                } @empty {
                  <li class="none muted">{{ 'Aucune alerte de stock.' | t }}</li>
                }
              </ul>
            </section>
          </div>

          <section class="card panel">
            <header class="panel-head">
              <h2>{{ 'Dernières commandes' | t }}</h2>
              <a routerLink="/admin/commandes" class="link">{{ 'Toutes les commandes' | t }}</a>
            </header>
            <div class="table-wrap">
              <table class="recent">
                <thead>
                  <tr>
                    <th>{{ 'Réf.' | t }}</th>
                    <th>{{ 'Client' | t }}</th>
                    <th class="hide-sm">{{ 'Date' | t }}</th>
                    <th>{{ 'Statut' | t }}</th>
                    <th class="hide-sm">{{ 'Paiement' | t }}</th>
                    <th class="num">{{ 'Total' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of d.recentOrders; track o.id) {
                    <tr>
                      <td>
                        <a
                          [routerLink]="['/admin/commandes']"
                          [queryParams]="{ ref: o.reference }"
                          >{{ o.reference }}</a
                        >
                      </td>
                      <td>{{ o.user?.firstName }} {{ o.user?.lastName }}</td>
                      <td class="hide-sm">{{ o.createdAt | date: 'dd/MM · HH:mm' }}</td>
                      <td>
                        <span class="pill" [class]="'tone-' + tone(o.status)">{{
                          statusLabels[o.status] | t
                        }}</span>
                      </td>
                      <td class="hide-sm">
                        <span class="pill" [class]="'tone-' + payTone(o.paymentStatus)">{{
                          paymentStatusLabels[o.paymentStatus] | t
                        }}</span>
                      </td>
                      <td class="num">{{ o.total | tnd }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      } @else if (!error()) {
        <div class="skeleton sk-board"></div>
      }
    </div>

    <ng-template #delta let-change>
      @if (change === null || change === undefined) {
        <p class="delta neutral">{{ 'Pas de comparaison possible' | t }}</p>
      } @else {
        <p class="delta" [class.up]="change > 0" [class.down]="change < 0">
          <app-icon [name]="change >= 0 ? 'trendUp' : 'trendDown'" [size]="15" [stroke]="2.2" />
          {{ signed(change) }}
          <span class="muted">{{ 'vs période précédente' | t }}</span>
        </p>
      }
    </ng-template>
  `,
  styles: `
    .page {
      padding-block: 1.5rem 3rem;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.3rem;
    }
    .head h1 {
      margin: 0 0 0.2rem;
      font-size: var(--fs-3xl);
    }
    .head p {
      margin: 0;
    }
    .periods {
      display: flex;
      gap: 0.25rem;
      padding: 0.25rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
    }
    .periods button {
      padding: 0.4rem 0.85rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--text-2);
      font: inherit;
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
    }
    .periods button:hover {
      background: var(--surface-2);
    }
    .periods button.on {
      color: var(--on-accent);
      background: var(--accent);
    }

    .board {
      display: grid;
      gap: 1rem;
      transition: opacity 0.2s;
    }
    .board.refreshing {
      opacity: 0.55;
      pointer-events: none;
    }

    .kpis {
      display: grid;
      grid-template-columns: 1.5fr repeat(3, 1fr);
      gap: 1rem;
    }
    .kpi {
      padding: 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .kpi h2 {
      margin: 0;
      font-family: var(--font-body);
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--muted);
    }
    .kpi .value {
      margin: 0;
      font-family: var(--font-body);
      font-size: var(--fs-2xl);
      font-weight: 700;
      color: var(--text);
    }
    .kpi.hero .value {
      font-size: 3rem;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .delta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      margin: auto 0 0;
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--text-2);
    }
    .delta.up {
      color: var(--green);
    }
    .delta.down {
      color: var(--red);
    }
    .delta .muted,
    .delta.neutral {
      font-weight: 500;
      color: var(--muted);
    }

    .actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }
    .action {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.9rem 1rem;
      color: var(--text);
      transition:
        border-color 0.2s,
        transform 0.2s;
    }
    .action:hover {
      border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
      transform: translateY(-2px);
    }
    .action > span:last-child {
      display: flex;
      flex-direction: column;
    }
    .action strong {
      font-size: var(--fs-xl);
      line-height: 1.1;
    }
    .action small {
      color: var(--muted);
      font-size: var(--fs-sm);
    }
    .action-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 13%, transparent);
    }

    .panel {
      padding: 1.2rem 1.3rem;
      min-width: 0;
    }
    .panel h2 {
      margin: 0;
      font-size: var(--fs-lg);
    }
    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .panel-head p {
      margin: 0.2rem 0 0;
      font-size: var(--fs-sm);
    }
    .sub {
      margin: 0.2rem 0 1rem;
      font-size: var(--fs-sm);
    }
    .link {
      color: var(--accent);
      font-size: var(--fs-sm);
      font-weight: 700;
      white-space: nowrap;
    }

    .cols {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }
    .cols.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .bars {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .bars li {
      display: grid;
      grid-template-columns: minmax(0, 8.5rem) 1fr auto;
      align-items: center;
      gap: 0.7rem;
    }
    .bar-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--fs-sm);
      color: var(--text-2);
    }
    .track {
      height: 10px;
      border-radius: 0 4px 4px 0;
      background: color-mix(in srgb, var(--viz-series) 12%, var(--surface));
    }
    .fill {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: 0 4px 4px 0;
      background: var(--viz-series);
    }
    .figure {
      min-width: 3.2rem;
      text-align: right;
      font-size: var(--fs-sm);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .bars .none {
      display: block;
    }

    .products {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      /* Colonne bornée à la carte : un nom long est tronqué au lieu d'élargir la liste */
      grid-template-columns: minmax(0, 1fr);
    }
    .products li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.55rem 0;
      border-bottom: 1px solid var(--border);
    }
    .products li:last-child {
      border-bottom: 0;
    }
    .rank {
      width: 1.4rem;
      color: var(--muted);
      font-weight: 700;
      text-align: center;
    }
    .thumb {
      flex: none;
      width: 42px;
      height: 42px;
      border-radius: var(--r-sm);
      overflow: hidden;
      background: radial-gradient(circle at 50% 40%, #fff, var(--ph-bg) 80%);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 0.2rem;
      mix-blend-mode: multiply;
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--fs-md);
      font-weight: 600;
    }
    .name:hover {
      color: var(--accent);
    }
    .nums {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      white-space: nowrap;
    }
    .nums small {
      font-size: var(--fs-xs);
    }

    .table-wrap {
      overflow-x: auto;
    }
    .recent {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-md);
    }
    .recent th {
      padding: 0.5rem 0.6rem;
      color: var(--muted);
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.05em;
      text-align: left;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border);
    }
    .recent td {
      padding: 0.65rem 0.6rem;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .recent tr:last-child td {
      border-bottom: 0;
    }
    .recent a {
      font-weight: 700;
    }
    .num {
      text-align: right !important;
      font-variant-numeric: tabular-nums;
    }
    .sk-board {
      height: 640px;
      border-radius: var(--r-xl);
    }

    @media (max-width: 1080px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .cols {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .hide-sm {
        display: none;
      }
    }
    @media (max-width: 760px) {
      .actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .cols,
      .cols.two {
        grid-template-columns: 1fr;
      }
      .kpi.hero {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 480px) {
      .head h1 {
        font-size: var(--fs-2xl);
      }
      .periods {
        width: 100%;
      }
      .periods button {
        flex: 1;
        padding-inline: 0.4rem;
      }
      .kpi .value {
        font-size: var(--fs-xl);
      }
      .kpi.hero .value {
        font-size: 2.4rem;
      }
      .actions {
        grid-template-columns: 1fr;
      }
      .bars li {
        grid-template-columns: minmax(0, 6.5rem) 1fr auto;
      }
    }
  `,
})
export class AdminDashboardPage {
  private readonly api = inject(AdminApiService);
  private readonly i18n = inject(I18nService);

  readonly periods = PERIODS;
  readonly statusLabels = STATUS_LABELS;
  readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  readonly days = signal<DashboardPeriod>(30);
  readonly data = signal<Dashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load(30);
  }

  load(days: DashboardPeriod) {
    this.days.set(days);
    this.loading.set(true);
    this.error.set(null);
    this.api.getDashboard(days).subscribe({
      next: (d) => {
        // La réponse d'une période abandonnée entre-temps est ignorée
        if (this.days() !== days) return;
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrors(e).join(' '));
      },
    });
  }

  /** Statuts dans l'ordre du parcours d'une commande, annulations à la fin */
  readonly statusBars = computed<Bar[]>(() => {
    const d = this.data();
    if (!d) return [];
    const counts = new Map(d.statuses.map((s) => [s.status, s.count]));
    const order: OrderStatus[] = [...ORDER_STEPS, 'CANCELLED'];
    const max = Math.max(1, ...counts.values());
    return order.map((status) => {
      const value = counts.get(status) ?? 0;
      return {
        key: status,
        label: STATUS_LABELS[status],
        value,
        figure: String(value),
        share: (value / max) * 100,
      };
    });
  });

  readonly paymentBars = computed<Bar[]>(() => {
    const d = this.data();
    if (!d) return [];
    const total = d.payments.reduce((s, p) => s + p.orders, 0) || 1;
    return [...d.payments]
      .sort((a, b) => b.orders - a.orders)
      .map((p) => ({
        key: p.method,
        label: PAYMENT_LABELS[p.method],
        value: p.orders,
        figure: `${Math.round((p.orders / total) * 100)} %`,
        share: (p.orders / total) * 100,
      }));
  });

  readonly maxCategory = computed(() =>
    Math.max(1, ...(this.data()?.categories.map((c) => c.revenue) ?? [])),
  );

  share(value: number, max: number) {
    return (value / max) * 100;
  }

  round(value: number) {
    return Math.round(value);
  }

  signed(change: number) {
    const n = new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }).format(
      Math.abs(change),
    );
    return `${change > 0 ? '+' : change < 0 ? '−' : ''}${n} %`;
  }

  /** Un seul format pour toute la liste, choisi d'après sa plus grande valeur */
  compactMoney(value: number, max: number) {
    return `${new Intl.NumberFormat(this.i18n.locale(), {
      notation: max >= 10_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value)} TND`;
  }

  tone(status: OrderStatus) {
    return statusTone(status);
  }

  payTone(status: Dashboard['recentOrders'][number]['paymentStatus']) {
    return paymentTone(status);
  }
}
