import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from '../components/icon';
import { OrderTimeline } from '../components/order-timeline';
import { ProductNamePipe, TPipe } from '../core/i18n';
import {
  OrdersApi,
  STATUS_LABELS,
  statusTone,
  type Order,
  type OrderStatus,
} from '../core/orders-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

type Filter = 'all' | 'active' | 'delivered' | 'cancelled';

const ACTIVE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED'];

// i18n
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'delivered', label: 'Livrées' },
  { id: 'cancelled', label: 'Annulées' },
];
// /i18n

function matches(order: Order, filter: Filter): boolean {
  if (filter === 'active') return ACTIVE.includes(order.status);
  if (filter === 'delivered') return order.status === 'DELIVERED';
  if (filter === 'cancelled') return order.status === 'CANCELLED';
  return true;
}

@Component({
  selector: 'app-account-orders',
  imports: [Icon, RouterLink, DatePipe, TndPipe, TPipe, ProductNamePipe, OrderTimeline],
  template: `
    <section class="card wrap">
      <header class="head">
        <h2>{{ 'Mes commandes' | t }}</h2>
        @if (orders(); as list) {
          @if (list.length) {
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
          }
        }
      </header>

      @if (error()) {
        <p class="alert">{{ error() }}</p>
      }

      @if (orders(); as list) {
        @if (!list.length) {
          <div class="empty">
            <app-icon name="orders" [size]="34" [stroke]="1.6" />
            <p>{{ "Vous n'avez pas encore passé de commande." | t }}</p>
            <a routerLink="/produits" class="btn primary">{{ 'Découvrir le catalogue' | t }}</a>
          </div>
        } @else if (!visible().length) {
          <p class="muted none">{{ 'Aucune commande dans cette catégorie.' | t }}</p>
        } @else {
          <ul class="list">
            @for (o of visible(); track o.id) {
              <li class="order">
                <a class="order-link" [routerLink]="['/commandes', o.id]">
                  <div class="top">
                    <div class="ident">
                      <strong>{{ o.reference }}</strong>
                      <small class="muted">{{ o.createdAt | date: 'dd/MM/yyyy' }}</small>
                    </div>
                    <span class="pill" [class]="'tone-' + tone(o.status)">{{
                      labels[o.status] | t
                    }}</span>
                  </div>

                  <div class="middle">
                    <div class="thumbs">
                      @for (item of o.items.slice(0, 4); track item.id) {
                        <span class="thumb" [title]="item.productName | productName">
                          @if (item.image) {
                            <img [src]="item.image.url" alt="" loading="lazy" decoding="async" />
                          }
                        </span>
                      }
                      @if (o.items.length > 4) {
                        <span class="thumb more">+{{ o.items.length - 4 }}</span>
                      }
                    </div>
                    <div class="sum">
                      <small class="muted">{{ '{n} article(s)' | t: { n: quantity(o) } }}</small>
                      <strong>{{ o.total | tnd }}</strong>
                    </div>
                  </div>

                  @if (o.status !== 'CANCELLED') {
                    <app-order-timeline [status]="o.status" [events]="o.events" [compact]="true" />
                  }

                  <span class="more-link">
                    {{ 'Voir le détail' | t }}
                    <app-icon name="arrowRight" [size]="14" [stroke]="2.4" />
                  </span>
                </a>
              </li>
            }
          </ul>
        }
      } @else if (!error()) {
        @for (i of [0, 1]; track i) {
          <div class="skeleton sk-order"></div>
        }
      }
    </section>
  `,
  styles: `
    .wrap {
      padding: 1.4rem 1.5rem;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      margin-bottom: 1.2rem;
    }
    .head h2 {
      margin: 0;
      font-size: var(--fs-xl);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
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
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.9rem;
    }
    .order-link {
      display: grid;
      gap: 1rem;
      padding: 1.1rem 1.2rem;
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      background: var(--bg);
      color: var(--text);
      transition:
        border-color 0.2s,
        box-shadow 0.2s,
        transform 0.2s;
    }
    .order-link:hover {
      border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
      box-shadow: var(--shadow-lift);
      transform: translateY(-2px);
    }
    .top,
    .middle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .ident {
      display: flex;
      flex-direction: column;
    }
    .thumbs {
      display: flex;
      gap: 0.4rem;
    }
    .thumb {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: var(--r-md);
      overflow: hidden;
      background: radial-gradient(circle at 50% 40%, #fff, var(--ph-bg) 80%);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 0.25rem;
      mix-blend-mode: multiply;
    }
    .thumb.more {
      background: var(--surface-2);
      color: var(--muted);
      font-size: var(--fs-sm);
      font-weight: 700;
    }
    .sum {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .sum strong {
      font-family: var(--font-display);
      font-size: var(--fs-lg);
    }
    .more-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      justify-self: end;
      color: var(--accent);
      font-size: var(--fs-sm);
      font-weight: 700;
    }
    .empty {
      display: grid;
      justify-items: center;
      gap: 0.8rem;
      padding: 2rem 1rem;
      color: var(--muted);
      text-align: center;
    }
    .none {
      padding: 1rem 0;
    }
    .sk-order {
      height: 150px;
      border-radius: var(--r-lg);
      margin-bottom: 0.9rem;
    }

    @media (max-width: 560px) {
      .wrap {
        padding: 1.1rem;
      }
      .thumb {
        width: 40px;
        height: 40px;
      }
      .order-link {
        padding: 1rem;
      }
    }
  `,
})
export class AccountOrdersPage {
  private readonly api = inject(OrdersApi);

  readonly filters = FILTERS;
  readonly labels = STATUS_LABELS;
  readonly filter = signal<Filter>('all');
  readonly orders = signal<Order[] | null>(null);
  readonly error = signal<string | null>(null);

  readonly visible = computed(() => (this.orders() ?? []).filter((o) => matches(o, this.filter())));
  readonly counts = computed(() => {
    const list = this.orders() ?? [];
    return Object.fromEntries(
      FILTERS.map((f) => [f.id, list.filter((o) => matches(o, f.id)).length]),
    ) as Record<Filter, number>;
  });

  constructor() {
    this.api.getMyOrders().subscribe({
      next: (list) => this.orders.set(list),
      error: (e) => this.error.set(apiErrors(e).join(' ')),
    });
  }

  tone(status: OrderStatus) {
    return statusTone(status);
  }

  quantity(o: Order) {
    return o.items.reduce((sum, i) => sum + i.quantity, 0);
  }
}
