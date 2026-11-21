import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { Icon } from '../components/icon';
import { OrderTimeline } from '../components/order-timeline';
import { AuthService } from '../core/auth-service';
import { ProductNamePipe, TPipe, translate } from '../core/i18n';
import {
  OrdersApi,
  PAYMENT_LABELS,
  PAYMENT_STATUS_LABELS,
  STATUS_HINTS,
  STATUS_LABELS,
  paymentTone,
  statusTone,
  type Order,
} from '../core/orders-api';
import { STORE, vatBreakdown } from '../core/store-info';
import { ToastService } from '../core/toast.service';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

type State = { status: 'loading' | 'notfound' | 'error' } | { status: 'ok'; order: Order };

@Component({
  selector: 'app-order-detail-page',
  imports: [Icon, RouterLink, DatePipe, TndPipe, TPipe, ProductNamePipe, OrderTimeline],
  template: `
    <div class="container page">
      @switch (state().status) {
        @case ('loading') {
          <div class="card skeleton-block"></div>
        }
        @case ('notfound') {
          <div class="card empty">
            <app-icon name="receipt" [size]="34" [stroke]="1.6" />
            <h1>{{ 'Commande introuvable' | t }}</h1>
            <a routerLink="/compte/commandes" class="btn primary">{{ 'Voir mes commandes' | t }}</a>
          </div>
        }
        @case ('error') {
          <div class="card empty">
            <app-icon name="warning" [size]="34" [stroke]="1.6" />
            <h1>{{ 'Impossible de charger la commande.' | t }}</h1>
            <a routerLink="/compte/commandes" class="btn">{{ 'Voir mes commandes' | t }}</a>
          </div>
        }
      }

      @if (order(); as o) {
        @if (nouvelle() && o.status !== 'CANCELLED') {
          <section class="thanks card">
            <span class="thanks-icon"
              ><app-icon name="checkCircle" [size]="30" [stroke]="2"
            /></span>
            <div>
              <h1>{{ 'Merci, votre commande est confirmée !' | t }}</h1>
              <p class="muted">
                @if (auth.user()?.email; as email) {
                  {{ 'Un e-mail récapitulatif a été envoyé à {email}.' | t: { email } }}
                }
                {{ 'Suivez ici chaque étape, jusqu’à la livraison.' | t }}
              </p>
            </div>
          </section>
        }

        <header class="head">
          <div>
            <a routerLink="/compte/commandes" class="back">
              <app-icon name="arrowLeft" [size]="15" /> {{ 'Mes commandes' | t }}
            </a>
            <h2>{{ 'Commande {ref}' | t: { ref: o.reference } }}</h2>
            <p class="muted">
              {{ 'Passée le {date}' | t: { date: (o.createdAt | date: 'dd/MM/yyyy · HH:mm') } }}
            </p>
          </div>
          <div class="head-actions">
            <a class="btn" [routerLink]="['/commandes', o.id, 'facture']">
              <app-icon name="fileText" [size]="16" /> {{ 'Facture' | t }}
            </a>
            @if (o.canCancel) {
              <button type="button" class="btn danger-soft" (click)="confirming.set(true)">
                <app-icon name="circleX" [size]="16" /> {{ 'Annuler la commande' | t }}
              </button>
            }
          </div>
        </header>

        <section class="card block">
          <div class="block-head">
            <h3>{{ 'Suivi' | t }}</h3>
            <span class="pill" [class]="'tone-' + tone(o)">{{ statusLabels[o.status] | t }}</span>
          </div>
          <app-order-timeline [status]="o.status" [events]="o.events" />
          <p class="hint">{{ statusHints[o.status] | t }}</p>
        </section>

        @if (awaitingTransfer(); as transfer) {
          <section class="card block transfer">
            <div class="block-head">
              <h3><app-icon name="bank" [size]="18" /> {{ 'Virement à effectuer' | t }}</h3>
              <strong class="amount">{{ transfer.total | tnd }}</strong>
            </div>
            <p class="muted">
              {{
                'Votre commande sera préparée dès réception du virement. Indiquez la référence de la commande dans le libellé.'
                  | t
              }}
            </p>
            <dl class="bank">
              <div>
                <dt>{{ 'Bénéficiaire' | t }}</dt>
                <dd>{{ store.bank.holder }}</dd>
              </div>
              <div>
                <dt>{{ 'Banque' | t }}</dt>
                <dd>{{ store.bank.name }}</dd>
              </div>
              <div>
                <dt>RIB</dt>
                <dd>
                  <code>{{ store.bank.rib }}</code>
                  <button type="button" class="copy" (click)="copy(store.bank.rib)">
                    {{ 'Copier' | t }}
                  </button>
                </dd>
              </div>
              <div>
                <dt>{{ 'Libellé' | t }}</dt>
                <dd>
                  <code>{{ transfer.reference }}</code>
                  <button type="button" class="copy" (click)="copy(transfer.reference)">
                    {{ 'Copier' | t }}
                  </button>
                </dd>
              </div>
            </dl>
          </section>
        }

        <div class="grid">
          <section class="card block items">
            <h3>{{ 'Articles ({n})' | t: { n: itemCount() } }}</h3>
            <ul>
              @for (item of o.items; track item.id) {
                <li>
                  <a class="thumb" [routerLink]="['/produits', item.productSlug]">
                    @if (item.image) {
                      <img [src]="item.image.url" [alt]="item.productName | productName" />
                    }
                  </a>
                  <div class="item-text">
                    <a [routerLink]="['/produits', item.productSlug]" class="item-name">{{
                      item.productName | productName
                    }}</a>
                    <small class="muted"
                      >{{ item.quantity }} × {{ item.unitPrice | tnd }} ·
                      {{ item.productSku }}</small
                    >
                  </div>
                  <strong class="line">{{ item.lineTotal | tnd }}</strong>
                </li>
              }
            </ul>
            <dl class="totals">
              <div>
                <dt>{{ 'Sous-total' | t }}</dt>
                <dd>{{ o.subtotal | tnd }}</dd>
              </div>
              <div>
                <dt>{{ 'Livraison' | t }}</dt>
                <dd>{{ o.shippingFee | tnd }}</dd>
              </div>
              <div class="grand">
                <dt>{{ 'Total TTC' | t }}</dt>
                <dd>{{ o.total | tnd }}</dd>
              </div>
              <div class="vat">
                <dt>{{ 'dont TVA (19 %)' | t }}</dt>
                <dd>{{ vat(o.total) | tnd }}</dd>
              </div>
            </dl>
          </section>

          <aside class="side">
            <section class="card block">
              <h3><app-icon name="mapPin" [size]="17" /> {{ 'Livraison' | t }}</h3>
              <p class="strong">{{ o.shippingName }}</p>
              <p class="muted">{{ o.shippingAddress }}</p>
              <p class="muted">{{ o.shippingPhone }}</p>
            </section>
            <section class="card block">
              <h3><app-icon name="creditCard" [size]="17" /> {{ 'Paiement' | t }}</h3>
              <p class="strong">{{ paymentLabels[o.paymentMethod] | t }}</p>
              <span class="pill" [class]="'tone-' + payTone(o)">{{
                paymentStatusLabels[o.paymentStatus] | t
              }}</span>
              @if (o.paidAt && o.paymentStatus === 'PAID') {
                <p class="muted small">
                  {{ 'Réglée le {date}' | t: { date: (o.paidAt | date: 'dd/MM/yyyy') } }}
                </p>
              }
            </section>
            <section class="card block help">
              <h3>{{ 'Une question ?' | t }}</h3>
              <p class="muted small">
                {{
                  'Notre service client répond sous 24 h, en indiquant la référence {ref}.'
                    | t: { ref: o.reference }
                }}
              </p>
              <a routerLink="/contact" class="btn block-btn">{{ 'Nous contacter' | t }}</a>
            </section>
          </aside>
        </div>

        <div class="foot">
          <a routerLink="/produits" class="btn primary">
            {{ 'Continuer mes achats' | t }}
            <app-icon name="arrowRight" [size]="16" [stroke]="2.2" />
          </a>
        </div>

        @if (confirming()) {
          <div class="modal-backdrop" (click)="confirming.set(false)">
            <div
              class="modal card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-title"
              (click)="$event.stopPropagation()"
            >
              <h3 id="cancel-title">
                {{ 'Annuler la commande {ref} ?' | t: { ref: o.reference } }}
              </h3>
              <p class="muted">
                {{ 'Les articles seront remis en vente. Cette action est définitive.' | t }}
                @if (o.paymentStatus === 'PAID') {
                  {{
                    'Le montant de {total} vous sera remboursé sous 5 à 10 jours.'
                      | t: { total: (o.total | tnd) }
                  }}
                }
              </p>
              @if (cancelError()) {
                <p class="alert">{{ cancelError() }}</p>
              }
              <div class="modal-actions">
                <button type="button" class="btn" (click)="confirming.set(false)">
                  {{ 'Garder ma commande' | t }}
                </button>
                <button
                  type="button"
                  class="btn danger"
                  [disabled]="cancelling()"
                  (click)="cancel(o)"
                >
                  {{ (cancelling() ? 'Annulation…' : 'Annuler la commande') | t }}
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .page {
      max-width: 1080px;
      padding-block: 2rem 3rem;
    }
    .skeleton-block {
      height: 340px;
      border: none;
      box-shadow: none;
    }
    .empty {
      display: grid;
      justify-items: center;
      gap: 1rem;
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--muted);
    }
    .empty h1 {
      margin: 0;
      font-size: var(--fs-2xl);
      color: var(--text);
    }

    .thanks {
      display: flex;
      align-items: center;
      gap: 1.1rem;
      padding: 1.4rem 1.6rem;
      margin-bottom: 1.6rem;
      border-color: color-mix(in srgb, var(--green) 35%, var(--border));
      background: linear-gradient(
        120deg,
        color-mix(in srgb, var(--green) 10%, var(--surface)),
        var(--surface) 70%
      );
      animation: rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    .thanks-icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      color: #fff;
      background: var(--green);
      box-shadow: 0 0 0 7px color-mix(in srgb, var(--green) 16%, transparent);
    }
    .thanks h1 {
      margin: 0 0 0.25rem;
      font-size: var(--fs-2xl);
    }
    .thanks p {
      margin: 0;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
    }

    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.2rem;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: var(--fs-sm);
      color: var(--muted);
    }
    .back:hover {
      color: var(--accent);
    }
    .head h2 {
      margin: 0.3rem 0 0.15rem;
      font-size: var(--fs-3xl);
      letter-spacing: -0.02em;
    }
    .head p {
      margin: 0;
    }
    .head-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .block {
      padding: 1.4rem 1.5rem;
      margin-bottom: 1.2rem;
    }
    .block h3 {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0 1rem;
      font-size: var(--fs-lg);
    }
    .block-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.3rem;
    }
    .block-head h3 {
      margin: 0;
    }
    .hint {
      margin: 1.3rem 0 0;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      color: var(--text-2);
      font-size: var(--fs-md);
    }

    .transfer {
      border-color: color-mix(in srgb, var(--warn) 40%, var(--border));
    }
    .transfer .amount {
      font-family: var(--font-display);
      font-size: var(--fs-xl);
      color: var(--accent);
    }
    .transfer p {
      margin: -0.5rem 0 1rem;
    }
    .bank {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.8rem 1.5rem;
      margin: 0;
    }
    .bank dt {
      font-size: var(--fs-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .bank dd {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.15rem 0 0;
      font-weight: 600;
    }
    code {
      font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
      font-size: var(--fs-md);
    }
    .copy {
      padding: 0.15rem 0.55rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: var(--fs-xs);
      font-weight: 700;
      cursor: pointer;
    }
    .copy:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 1.2rem;
      align-items: start;
    }
    .items ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .items li {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 0.8rem 0;
      border-bottom: 1px solid var(--border);
    }
    .items li:first-child {
      padding-top: 0;
    }
    .thumb {
      flex: none;
      width: 64px;
      height: 64px;
      border-radius: var(--r-md);
      overflow: hidden;
      background: radial-gradient(circle at 50% 40%, #fff, var(--ph-bg) 80%);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 0.35rem;
      mix-blend-mode: multiply;
    }
    .item-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .item-name {
      font-weight: 600;
      line-height: 1.3;
    }
    .item-name:hover {
      color: var(--accent);
    }
    .line {
      white-space: nowrap;
    }
    .totals {
      margin: 1rem 0 0;
      display: grid;
      gap: 0.35rem;
    }
    .totals div {
      display: flex;
      justify-content: space-between;
    }
    .totals dt {
      color: var(--text-2);
    }
    .totals dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .totals .grand {
      margin-top: 0.4rem;
      padding-top: 0.7rem;
      border-top: 1px solid var(--border);
      font-family: var(--font-display);
      font-size: var(--fs-xl);
      font-weight: 700;
    }
    .totals .grand dt,
    .totals .grand dd {
      color: var(--accent);
    }
    .totals .vat {
      font-size: var(--fs-sm);
    }
    .totals .vat dt,
    .totals .vat dd {
      color: var(--muted);
    }

    .side .block p {
      margin: 0 0 0.25rem;
    }
    .strong {
      font-weight: 700;
    }
    .small {
      font-size: var(--fs-sm);
      margin-top: 0.6rem !important;
    }
    .side .pill {
      margin-top: 0.3rem;
    }
    .block-btn {
      width: 100%;
      margin-top: 0.8rem;
    }
    .foot {
      display: flex;
      justify-content: center;
      margin-top: 0.8rem;
    }

    .btn.danger-soft {
      color: var(--red);
      border-color: color-mix(in srgb, var(--red) 35%, var(--border));
    }
    .btn.danger-soft:hover {
      background: color-mix(in srgb, var(--red) 9%, var(--surface));
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
      width: min(500px, 100%);
      padding: 1.6rem;
    }
    .modal h3 {
      margin: 0 0 0.6rem;
      font-size: var(--fs-xl);
    }
    .modal-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 1.3rem;
    }

    @media (max-width: 860px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 560px) {
      .head h2 {
        font-size: var(--fs-2xl);
      }
      .head-actions,
      .head-actions .btn {
        width: 100%;
      }
      .thanks {
        align-items: flex-start;
        padding: 1.1rem;
      }
      .thanks-icon {
        width: 44px;
        height: 44px;
      }
      .thanks h1 {
        font-size: var(--fs-xl);
      }
      .bank {
        grid-template-columns: 1fr;
      }
      .thumb {
        width: 52px;
        height: 52px;
      }
    }
  `,
})
export class OrderDetailPage {
  private readonly api = inject(OrdersApi);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  /** Présent après le passage de commande (?nouvelle=1) : message de remerciement */
  readonly nouvelle = input<string>();

  readonly store = STORE;
  readonly statusLabels = STATUS_LABELS;
  readonly statusHints = STATUS_HINTS;
  readonly paymentLabels = PAYMENT_LABELS;
  readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;

  readonly confirming = signal(false);
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);
  /** Commande mise à jour après une annulation (remplace celle chargée) */
  private readonly updated = signal<Order | null>(null);

  private readonly loaded = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.api.getOrder(Number(id)).pipe(
          map((order): State => ({ status: 'ok', order })),
          catchError((e: HttpErrorResponse) =>
            of<State>({ status: e.status === 404 || e.status === 400 ? 'notfound' : 'error' }),
          ),
          startWith<State>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as State },
  );

  readonly order = computed(() => {
    const state = this.loaded();
    if (state.status !== 'ok') return null;
    const updated = this.updated();
    return updated?.id === state.order.id ? updated : state.order;
  });
  readonly state = computed(() => this.loaded());

  readonly itemCount = computed(
    () => this.order()?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0,
  );

  readonly awaitingTransfer = computed(() => {
    const o = this.order();
    return o?.paymentMethod === 'BANK_TRANSFER' &&
      o.paymentStatus === 'PENDING' &&
      o.status !== 'CANCELLED'
      ? o
      : null;
  });

  tone(o: Order) {
    return statusTone(o.status);
  }

  payTone(o: Order) {
    return paymentTone(o.paymentStatus);
  }

  vat(total: number) {
    return vatBreakdown(total).vat;
  }

  copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => this.toast.success('Copié dans le presse-papiers', value), // traduit à l'affichage
      () => undefined,
    );
  }

  cancel(o: Order) {
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.api.cancel(o.id).subscribe({
      next: (order) => {
        this.updated.set(order);
        this.cancelling.set(false);
        this.confirming.set(false);
        this.toast.success('Commande annulée', o.reference); // traduit à l'affichage
      },
      error: (e) => {
        this.cancelling.set(false);
        this.cancelError.set(apiErrors(e).join(' ') || translate('Une erreur est survenue.'));
      },
    });
  }
}
