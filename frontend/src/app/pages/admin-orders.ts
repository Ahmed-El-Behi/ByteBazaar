import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../components/admin-nav';
import { Icon, type IconName } from '../components/icon';
import { OrderTimeline } from '../components/order-timeline';
import {
  AdminApiService,
  type AdminOrder,
  type AdminOrderFilter,
  type AdminOrderPage,
  type AdminOrderSummary,
} from '../core/admin-api';
import { ProductNamePipe, TPipe, translate } from '../core/i18n';
import {
  PAYMENT_LABELS,
  PAYMENT_STATUS_LABELS,
  STATUS_LABELS,
  paymentTone,
  statusTone,
  type OrderStatus,
  type PaymentStatus,
} from '../core/orders-api';
import { ToastService } from '../core/toast.service';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

type Filter = AdminOrderFilter;

// i18n
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'toutes', label: 'Toutes' },
  { id: 'a-traiter', label: 'À traiter' },
  { id: 'expediees', label: 'Expédiées' },
  { id: 'livrees', label: 'Livrées' },
  { id: 'annulees', label: 'Annulées' },
  { id: 'virements', label: 'Virements en attente' },
];

/** Étape suivante proposée pour chaque statut, avec le libellé de son bouton */
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string; icon: IconName }>> = {
  PENDING: { status: 'CONFIRMED', label: 'Confirmer', icon: 'check' },
  CONFIRMED: { status: 'PREPARING', label: 'Lancer la préparation', icon: 'package' },
  PREPARING: { status: 'SHIPPED', label: 'Marquer expédiée', icon: 'truck' },
  SHIPPED: { status: 'DELIVERED', label: 'Marquer livrée', icon: 'checkCircle' },
};
// /i18n

const NO_COUNTS: Record<Filter, number> = {
  toutes: 0,
  'a-traiter': 0,
  expediees: 0,
  livrees: 0,
  annulees: 0,
  virements: 0,
};

interface Pending {
  order: AdminOrderSummary;
  change: { status?: OrderStatus; paymentStatus?: PaymentStatus };
  title: string;
}

@Component({
  selector: 'app-admin-orders',
  imports: [AdminNav, Icon, OrderTimeline, RouterLink, DatePipe, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="container page">
      <app-admin-nav />

      <header class="head">
        <div>
          <h1>{{ 'Commandes' | t }}</h1>
          <p class="muted">{{ '{n} commande(s) au total' | t: { n: counts().toutes } }}</p>
        </div>
        <button type="button" class="btn" (click)="refresh()" [disabled]="loading()">
          <app-icon name="refresh" [size]="16" /> {{ 'Actualiser' | t }}
        </button>
      </header>

      <div class="toolbar">
        <label class="search">
          <app-icon name="search" [size]="16" />
          <input
            type="search"
            [value]="query()"
            (input)="onSearch($any($event.target).value)"
            [placeholder]="'Référence, client, e-mail ou téléphone…' | t"
            [attr.aria-label]="'Rechercher une commande' | t"
          />
        </label>
        <div class="filters" role="tablist">
          @for (f of filters; track f.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="filter() === f.id"
              [class.on]="filter() === f.id"
              (click)="setFilter(f.id)"
            >
              {{ f.label | t }} <span class="count">{{ counts()[f.id] }}</span>
            </button>
          }
        </div>
      </div>

      @if (error()) {
        <p class="alert">{{ error() }}</p>
      }

      <section class="card list" #list [class.refreshing]="loading() && result()">
        @if (!result()) {
          <div class="skeleton sk-list"></div>
        } @else if (!rows().length) {
          <p class="muted none">{{ 'Aucune commande ne correspond.' | t }}</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>{{ 'Réf.' | t }}</th>
                <th class="hide-xs">{{ 'Client' | t }}</th>
                <th class="hide-sm">{{ 'Date' | t }}</th>
                <th>{{ 'Statut' | t }}</th>
                <th class="hide-sm">{{ 'Paiement' | t }}</th>
                <th class="num">{{ 'Total' | t }}</th>
                <th>
                  <span class="sr-only">{{ 'Détails' | t }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (o of rows(); track o.id) {
                <tr class="row" [class.open]="openId() === o.id" (click)="toggle(o.id)">
                  <td class="c-ref">
                    <strong class="nowrap">{{ o.reference }}</strong>
                    <small class="muted block only-xs"
                      >{{ o.user?.firstName }} {{ o.user?.lastName }}</small
                    >
                  </td>
                  <td class="hide-xs">
                    <span class="client">{{ o.user?.firstName }} {{ o.user?.lastName }}</span>
                    <small class="muted block hide-sm">{{ o.user?.email }}</small>
                  </td>
                  <td class="hide-sm">{{ o.createdAt | date: 'dd/MM/yyyy · HH:mm' }}</td>
                  <td class="c-status">
                    <span class="pill" [class]="'tone-' + tone(o.status)">{{
                      statusLabels[o.status] | t
                    }}</span>
                  </td>
                  <td class="hide-sm">
                    <span class="pill" [class]="'tone-' + payTone(o.paymentStatus)">{{
                      paymentStatusLabels[o.paymentStatus] | t
                    }}</span>
                    <small class="muted block">{{ paymentLabels[o.paymentMethod] | t }}</small>
                  </td>
                  <td class="num c-total">
                    <strong>{{ o.total | tnd }}</strong>
                  </td>
                  <td class="chev">
                    <button
                      type="button"
                      class="icon-btn"
                      [attr.aria-expanded]="openId() === o.id"
                      [attr.aria-label]="'Voir les détails' | t"
                    >
                      <app-icon name="chevronDown" [size]="18" />
                    </button>
                  </td>
                </tr>
                @if (openId() === o.id) {
                  <tr class="details">
                    <td colspan="7">
                      @if (details()[o.id]; as d) {
                        <div class="detail-grid">
                          <section>
                            <h3>{{ 'Suivi' | t }}</h3>
                            <app-order-timeline [status]="d.status" [events]="d.events" />
                            <ul class="history">
                              @for (e of d.events; track $index) {
                                <li>
                                  <span class="pill" [class]="'tone-' + tone(e.status)">{{
                                    statusLabels[e.status] | t
                                  }}</span>
                                  <span class="muted">{{
                                    e.createdAt | date: 'dd/MM/yyyy · HH:mm'
                                  }}</span>
                                  @if (e.performedBy) {
                                    <span class="muted">
                                      — {{ e.performedBy.firstName }} {{ e.performedBy.lastName }}
                                    </span>
                                  }
                                </li>
                              }
                            </ul>
                          </section>

                          <section>
                            <h3>{{ 'Articles' | t }}</h3>
                            <ul class="items">
                              @for (item of d.items; track item.id) {
                                <li>
                                  <span>
                                    <a [routerLink]="['/produits', item.productSlug]">{{
                                      item.productName | productName
                                    }}</a>
                                    <small class="muted block">{{ item.productSku }}</small>
                                  </span>
                                  <span class="nowrap"
                                    >{{ item.quantity }} × {{ item.unitPrice | tnd }}</span
                                  >
                                </li>
                              }
                            </ul>
                            <p class="totals">
                              {{ 'Livraison' | t }} {{ d.shippingFee | tnd }} ·
                              <strong>{{ 'Total' | t }} {{ d.total | tnd }}</strong>
                            </p>

                            <h3>{{ 'Livraison' | t }}</h3>
                            <p class="addr">
                              <strong>{{ d.shippingName }}</strong> · {{ d.shippingPhone }}<br />
                              {{ d.shippingAddress }}
                            </p>
                          </section>
                        </div>

                        <div class="actions">
                          @if (next(d); as n) {
                            <button
                              type="button"
                              class="btn primary"
                              (click)="ask(d, { status: n.status }, n.label)"
                            >
                              <app-icon [name]="n.icon" [size]="16" /> {{ n.label | t }}
                            </button>
                          }
                          @if (d.paymentStatus === 'PENDING' && d.status !== 'CANCELLED') {
                            <button
                              type="button"
                              class="btn"
                              (click)="ask(d, { paymentStatus: 'PAID' }, 'Marquer comme payée')"
                            >
                              <app-icon name="banknote" [size]="16" />
                              {{ 'Marquer comme payée' | t }}
                            </button>
                          }
                          <a class="btn" [routerLink]="['/admin/commandes', d.id, 'facture']">
                            <app-icon name="fileText" [size]="16" /> {{ 'Facture' | t }}
                          </a>
                          @if (d.status !== 'CANCELLED' && d.status !== 'DELIVERED') {
                            <button
                              type="button"
                              class="btn danger-soft"
                              (click)="ask(d, { status: 'CANCELLED' }, 'Annuler la commande')"
                            >
                              <app-icon name="circleX" [size]="16" />
                              {{ 'Annuler la commande' | t }}
                            </button>
                          }
                        </div>
                      } @else {
                        <div class="skeleton sk-detail"></div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        }
      </section>

      @if (result(); as r) {
        @if (r.meta.totalPages > 1) {
          <nav class="pager" [attr.aria-label]="'Pagination' | t">
            <button
              type="button"
              class="btn"
              [disabled]="r.meta.page <= 1 || loading()"
              (click)="goTo(r.meta.page - 1, list)"
            >
              <app-icon name="chevronLeft" [size]="16" [stroke]="2" /> {{ 'Précédent' | t }}
            </button>
            <span class="muted">{{
              'Page {page} / {total}' | t: { page: r.meta.page, total: r.meta.totalPages }
            }}</span>
            <button
              type="button"
              class="btn"
              [disabled]="r.meta.page >= r.meta.totalPages || loading()"
              (click)="goTo(r.meta.page + 1, list)"
            >
              {{ 'Suivant' | t }} <app-icon name="chevronRight" [size]="16" [stroke]="2" />
            </button>
          </nav>
        }
      }

      @if (pending(); as p) {
        <div class="modal-backdrop" (click)="pending.set(null)">
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            (click)="$event.stopPropagation()"
          >
            <h3 id="confirm-title">{{ p.title | t }} — {{ p.order.reference }}</h3>
            <p class="muted">
              @if (p.change.status === 'CANCELLED') {
                {{
                  'Les articles seront remis en stock et le client prévenu par e-mail. Cette action est définitive.'
                    | t
                }}
                @if (p.order.paymentStatus === 'PAID') {
                  {{ 'Le paiement sera marqué comme remboursé.' | t }}
                }
              } @else if (p.change.status) {
                {{
                  'Le client sera prévenu par e-mail du nouveau statut : {status}.'
                    | t: { status: (statusLabels[p.change.status] | t) }
                }}
              } @else {
                {{ 'Le paiement de cette commande sera enregistré comme reçu.' | t }}
              }
            </p>
            <div class="modal-actions">
              <button type="button" class="btn" (click)="pending.set(null)">
                {{ 'Retour' | t }}
              </button>
              <button
                type="button"
                class="btn"
                [class.primary]="p.change.status !== 'CANCELLED'"
                [class.danger]="p.change.status === 'CANCELLED'"
                [disabled]="saving()"
                (click)="confirm(p)"
              >
                {{ (saving() ? 'Enregistrement…' : 'Confirmer') | t }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: 1.5rem 3rem;
    }
    .head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .head h1 {
      margin: 0 0 0.2rem;
      font-size: var(--fs-3xl);
    }
    .head p {
      margin: 0;
    }
    .toolbar {
      display: grid;
      gap: 0.8rem;
      margin-bottom: 1rem;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: 460px;
      padding: 0 0.9rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
    }
    .search:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }
    .search input {
      flex: 1;
      min-width: 0;
      padding: 0.6rem 0;
      border: 0 !important;
      outline: none !important;
      box-shadow: none !important;
      background: transparent;
      color: var(--text);
      font: inherit;
    }
    .filters {
      display: flex;
      gap: 0.35rem;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .filters button {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.8rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--text-2);
      font: inherit;
      font-size: var(--fs-sm);
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }
    .filters button:hover {
      border-color: var(--accent);
    }
    .filters button.on {
      color: var(--on-accent);
      background: var(--accent);
      border-color: var(--accent);
    }
    .count {
      min-width: 1.4em;
      padding: 0 0.35rem;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 14%, transparent);
      font-size: var(--fs-xs);
      text-align: center;
    }

    .list {
      position: relative;
      padding: 0;
      overflow-x: auto;
      transition: opacity 0.2s;
    }
    .list.refreshing {
      opacity: 0.55;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-md);
    }
    th {
      padding: 0.75rem 1rem;
      background: var(--surface-2);
      color: var(--muted);
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.05em;
      text-align: left;
      text-transform: uppercase;
    }
    td {
      padding: 0.8rem 1rem;
      border-top: 1px solid var(--border);
      vertical-align: middle;
    }
    .row {
      cursor: pointer;
    }
    .row:hover td,
    .row.open td {
      background: color-mix(in srgb, var(--accent) 4%, transparent);
    }
    .client {
      font-weight: 600;
    }
    .block {
      display: block;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .chev {
      width: 1%;
    }
    .icon-btn {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 1px solid var(--border);
      border-radius: 50%;
      background: var(--surface);
      color: var(--muted);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .row.open .icon-btn {
      transform: rotate(180deg);
      color: var(--accent);
      border-color: var(--accent);
    }
    .details td {
      border-top: 0;
      padding: 0.4rem 1rem 1.4rem;
      background: color-mix(in srgb, var(--accent) 4%, transparent);
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 1.6rem;
      padding: 1rem 1.1rem;
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      background: var(--surface);
    }
    .detail-grid h3 {
      margin: 0 0 0.8rem;
      font-size: var(--fs-md);
    }
    .detail-grid h3:not(:first-child) {
      margin-top: 1.1rem;
    }
    .history {
      list-style: none;
      margin: 1.1rem 0 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
      font-size: var(--fs-sm);
    }
    .history li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    .items li {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: var(--fs-sm);
    }
    .items a:hover {
      color: var(--accent);
    }
    .nowrap {
      white-space: nowrap;
    }
    .totals {
      margin: 0.7rem 0 0;
      text-align: right;
      font-size: var(--fs-sm);
    }
    .addr {
      margin: 0;
      font-size: var(--fs-sm);
      line-height: 1.5;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-top: 1rem;
    }
    .none {
      padding: 2rem;
      text-align: center;
    }
    .sk-list {
      height: 420px;
    }
    .sk-detail {
      height: 220px;
      border-radius: var(--r-lg);
    }
    .pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 1.2rem;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    .btn.danger {
      color: #fff;
      background: var(--red);
      border-color: var(--red);
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgba(8, 12, 24, 0.55);
    }
    .modal {
      width: min(460px, 100%);
      padding: 1.6rem;
    }
    .modal h3 {
      margin: 0 0 0.6rem;
      font-size: var(--fs-lg);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 1.3rem;
    }

    @media (max-width: 860px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
    .only-xs {
      display: none;
    }
    @media (max-width: 640px) {
      .hide-sm {
        display: none;
      }
      th,
      td {
        padding-inline: 0.6rem;
      }
      .head h1 {
        font-size: var(--fs-2xl);
      }
      .actions .btn {
        flex: 1 1 100%;
      }
    }
    /* Téléphone : chaque commande devient une carte (référence et bouton en haut,
       statut et total dessous), le détail se déplie sur toute la largeur */
    @media (max-width: 480px) {
      table,
      tbody,
      tr,
      td {
        display: block;
      }
      thead {
        display: none;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.5rem 0.8rem;
        padding: 0.8rem 0.9rem;
        border-top: 1px solid var(--border);
      }
      .row td {
        padding: 0;
        border: 0;
        background: none !important;
      }
      .c-ref {
        grid-area: 1 / 1;
      }
      .chev {
        grid-area: 1 / 2;
        width: auto;
      }
      .c-status {
        grid-area: 2 / 1;
      }
      .c-total {
        grid-area: 2 / 2;
      }
      .details td {
        padding: 0 0.6rem 1rem;
      }
      .detail-grid {
        padding: 0.9rem;
      }
      .hide-xs {
        display: none;
      }
      .only-xs {
        display: block;
      }
    }
  `,
})
export class AdminOrdersPage implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  /** Filtre ou référence transmis par le tableau de bord (?filtre=…, ?ref=…) */
  readonly filtre = input<string>();
  readonly ref = input<string>();

  readonly filters = FILTERS;
  readonly statusLabels = STATUS_LABELS;
  readonly paymentLabels = PAYMENT_LABELS;
  readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;

  /** Page courante renvoyée par l'API (25 commandes, filtre et recherche appliqués côté serveur) */
  readonly result = signal<AdminOrderPage | null>(null);
  readonly rows = computed(() => this.result()?.data ?? []);
  readonly counts = computed(() => this.result()?.counts ?? NO_COUNTS);
  /** Détail des commandes ouvertes (articles, historique, livraison), chargé à la demande */
  readonly details = signal<Record<number, AdminOrder>>({});

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly filter = signal<Filter>('toutes');
  readonly page = signal(1);
  readonly openId = signal<number | null>(null);
  readonly pending = signal<Pending | null>(null);
  readonly saving = signal(false);

  private readonly requests = new Subject<void>();
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Référence à ouvrir dès qu'elle apparaît dans la liste (lien du tableau de bord) */
  private openRef: string | null = null;

  constructor() {
    // Une nouvelle demande annule la précédente : une réponse périmée n'écrase jamais la liste
    this.requests
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api
            .listOrders({ filter: this.filter(), q: this.query(), page: this.page() })
            .pipe(
              catchError((e) => {
                this.error.set(apiErrors(e).join(' '));
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res) return;
        this.result.set(res);
        if (this.openRef) {
          const match = res.data.find((o) => o.reference === this.openRef);
          this.openRef = null;
          if (match) this.toggle(match.id);
        }
      });
  }

  ngOnInit() {
    const filtre = this.filtre();
    if (filtre && FILTERS.some((f) => f.id === filtre)) this.filter.set(filtre as Filter);
    const ref = this.ref();
    if (ref) {
      this.query.set(ref);
      this.openRef = ref;
    }
    this.load();
  }

  load() {
    this.requests.next();
  }

  /** Bouton « Actualiser » : liste, compteurs et détail ouvert rechargés */
  refresh() {
    this.details.set({});
    const open = this.openId();
    this.load();
    if (open) this.loadDetail(open);
  }

  /** Recherche lancée 300 ms après la dernière frappe */
  onSearch(value: string) {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.openId.set(null);
      this.load();
    }, 300);
  }

  setFilter(filter: Filter) {
    if (filter === this.filter()) return;
    this.filter.set(filter);
    this.page.set(1);
    this.openId.set(null);
    this.load();
  }

  goTo(page: number, list: HTMLElement) {
    this.page.set(page);
    this.openId.set(null);
    this.load();
    if (list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' });
  }

  toggle(id: number) {
    if (this.openId() === id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(id);
    if (!this.details()[id]) this.loadDetail(id);
  }

  private loadDetail(id: number) {
    this.api.getAdminOrderDetails(id).subscribe({
      next: (order) => this.details.update((all) => ({ ...all, [id]: order })),
      error: (e) => this.error.set(apiErrors(e).join(' ')),
    });
  }

  next(o: AdminOrderSummary) {
    return NEXT[o.status] ?? null;
  }

  ask(order: AdminOrderSummary, change: Pending['change'], title: string) {
    this.pending.set({ order, change, title });
  }

  confirm(p: Pending) {
    this.saving.set(true);
    this.api.updateOrderStatus(p.order.id, p.change).subscribe({
      next: (updated) => {
        this.details.update((all) => ({ ...all, [updated.id]: updated }));
        this.saving.set(false);
        this.pending.set(null);
        this.toast.success('Commande mise à jour', updated.reference); // traduit à l'affichage
        // Ligne et compteurs à jour (la commande peut changer de filtre)
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.pending.set(null);
        this.error.set(`${translate('Erreur lors de la mise à jour :')} ${apiErrors(e).join(' ')}`);
      },
    });
  }

  tone(status: OrderStatus) {
    return statusTone(status);
  }

  payTone(status: PaymentStatus) {
    return paymentTone(status);
  }
}
