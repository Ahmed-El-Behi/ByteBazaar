import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminNav } from '../components/admin-nav';
import { Icon, type IconName } from '../components/icon';
import { OrderTimeline } from '../components/order-timeline';
import { AdminApiService, type AdminOrder } from '../core/admin-api';
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

type Filter = 'toutes' | 'a-traiter' | 'expediees' | 'livrees' | 'annulees' | 'virements';

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

function matches(o: AdminOrder, filter: Filter): boolean {
  switch (filter) {
    case 'a-traiter':
      return ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status);
    case 'expediees':
      return o.status === 'SHIPPED';
    case 'livrees':
      return o.status === 'DELIVERED';
    case 'annulees':
      return o.status === 'CANCELLED';
    case 'virements':
      return (
        o.paymentMethod === 'BANK_TRANSFER' &&
        o.paymentStatus === 'PENDING' &&
        o.status !== 'CANCELLED'
      );
    default:
      return true;
  }
}

interface Pending {
  order: AdminOrder;
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
          <p class="muted">{{ '{n} commande(s) au total' | t: { n: orders().length } }}</p>
        </div>
        <button type="button" class="btn" (click)="load()" [disabled]="loading()">
          <app-icon name="refresh" [size]="16" /> {{ 'Actualiser' | t }}
        </button>
      </header>

      <div class="toolbar">
        <label class="search">
          <app-icon name="search" [size]="16" />
          <input
            type="search"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
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
              (click)="filter.set(f.id)"
            >
              {{ f.label | t }} <span class="count">{{ counts()[f.id] }}</span>
            </button>
          }
        </div>
      </div>

      @if (error()) {
        <p class="alert">{{ error() }}</p>
      }

      <section class="card list" [class.refreshing]="loading() && orders().length">
        @if (loading() && !orders().length) {
          <div class="skeleton sk-list"></div>
        } @else if (!visible().length) {
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
              @for (o of visible(); track o.id) {
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
                      <div class="detail-grid">
                        <section>
                          <h3>{{ 'Suivi' | t }}</h3>
                          <app-order-timeline [status]="o.status" [events]="o.events" />
                          <ul class="history">
                            @for (e of o.events; track $index) {
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
                            @for (item of o.items; track item.id) {
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
                            {{ 'Livraison' | t }} {{ o.shippingFee | tnd }} ·
                            <strong>{{ 'Total' | t }} {{ o.total | tnd }}</strong>
                          </p>

                          <h3>{{ 'Livraison' | t }}</h3>
                          <p class="addr">
                            <strong>{{ o.shippingName }}</strong> · {{ o.shippingPhone }}<br />
                            {{ o.shippingAddress }}
                          </p>
                        </section>
                      </div>

                      <div class="actions">
                        @if (next(o); as n) {
                          <button
                            type="button"
                            class="btn primary"
                            (click)="ask(o, { status: n.status }, n.label)"
                          >
                            <app-icon [name]="n.icon" [size]="16" /> {{ n.label | t }}
                          </button>
                        }
                        @if (o.paymentStatus === 'PENDING' && o.status !== 'CANCELLED') {
                          <button
                            type="button"
                            class="btn"
                            (click)="ask(o, { paymentStatus: 'PAID' }, 'Marquer comme payée')"
                          >
                            <app-icon name="banknote" [size]="16" /> {{ 'Marquer comme payée' | t }}
                          </button>
                        }
                        <a class="btn" [routerLink]="['/admin/commandes', o.id, 'facture']">
                          <app-icon name="fileText" [size]="16" /> {{ 'Facture' | t }}
                        </a>
                        @if (o.status !== 'CANCELLED' && o.status !== 'DELIVERED') {
                          <button
                            type="button"
                            class="btn danger-soft"
                            (click)="ask(o, { status: 'CANCELLED' }, 'Annuler la commande')"
                          >
                            <app-icon name="circleX" [size]="16" /> {{ 'Annuler la commande' | t }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        }
      </section>

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
export class AdminOrdersPage {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  /** Filtre ou référence transmis par le tableau de bord (?filtre=…, ?ref=…) */
  readonly filtre = input<string>();
  readonly ref = input<string>();

  readonly filters = FILTERS;
  readonly statusLabels = STATUS_LABELS;
  readonly paymentLabels = PAYMENT_LABELS;
  readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;

  readonly orders = signal<AdminOrder[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly filter = signal<Filter>('toutes');
  readonly openId = signal<number | null>(null);
  readonly pending = signal<Pending | null>(null);
  readonly saving = signal(false);

  readonly counts = computed(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, this.orders().filter((o) => matches(o, f.id)).length]),
      ) as Record<Filter, number>,
  );

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const filter = this.filter();
    return this.orders().filter((o) => {
      if (!matches(o, filter)) return false;
      if (!q) return true;
      const haystack = [
        o.reference,
        o.user?.firstName,
        o.user?.lastName,
        o.user?.email,
        o.user?.phone,
        o.shippingName,
        o.shippingPhone,
      ]
        .join(' ')
        .toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  });

  constructor() {
    this.load(true);
  }

  load(first = false) {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAllOrders().subscribe({
      next: (list) => {
        this.orders.set(list);
        this.loading.set(false);
        if (first) this.applyLink(list);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrors(e).join(' '));
      },
    });
  }

  /** Lien du tableau de bord : filtre présélectionné, ou commande ouverte directement */
  private applyLink(list: AdminOrder[]) {
    const filtre = this.filtre();
    if (filtre && FILTERS.some((f) => f.id === filtre)) this.filter.set(filtre as Filter);
    const ref = this.ref();
    if (ref) {
      this.query.set(ref);
      this.openId.set(list.find((o) => o.reference === ref)?.id ?? null);
    }
  }

  toggle(id: number) {
    this.openId.set(this.openId() === id ? null : id);
  }

  next(o: AdminOrder) {
    return NEXT[o.status] ?? null;
  }

  ask(order: AdminOrder, change: Pending['change'], title: string) {
    this.pending.set({ order, change, title });
  }

  confirm(p: Pending) {
    this.saving.set(true);
    this.api.updateOrderStatus(p.order.id, p.change).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
        this.saving.set(false);
        this.pending.set(null);
        this.toast.success('Commande mise à jour', updated.reference); // traduit à l'affichage
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
