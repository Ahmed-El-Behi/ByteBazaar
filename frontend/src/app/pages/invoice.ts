import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { LogoMark } from '../components/logo-mark';
import { Icon } from '../components/icon';
import { AdminApiService } from '../core/admin-api';
import { AuthService } from '../core/auth-service';
import { ProductNamePipe, TPipe } from '../core/i18n';
import { OrdersApi, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, type Order } from '../core/orders-api';
import { STORE, VAT_RATE, vatBreakdown } from '../core/store-info';
import { TndPipe } from '../core/tnd.pipe';

/**
 * Facture imprimable d'une commande (« Imprimer » ou « Enregistrer au format PDF » du
 * navigateur). Une seule page pour le client (/commandes/:id/facture) et l'administrateur
 * (/admin/commandes/:id/facture, route avec data.admin). La feuille reste blanche dans les
 * deux thèmes, comme un document papier.
 */
@Component({
  selector: 'app-invoice',
  imports: [Icon, LogoMark, RouterLink, DatePipe, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="container page">
      <div class="toolbar no-print">
        <a [routerLink]="backLink()" class="back">
          <app-icon name="arrowLeft" [size]="15" /> {{ 'Retour à la commande' | t }}
        </a>
        @if (order()) {
          <button type="button" class="btn primary" (click)="print()">
            <app-icon name="printer" [size]="16" /> {{ 'Imprimer / PDF' | t }}
          </button>
        }
      </div>

      @if (order(); as o) {
        <article class="sheet">
          @if (o.status === 'CANCELLED') {
            <p class="void">{{ 'Commande annulée — document sans valeur de paiement' | t }}</p>
          }
          <header class="top">
            <div class="seller">
              <div class="brand">
                <app-logo-mark class="mark" />
                <span>Byte<b>Bazaar</b></span>
              </div>
              <p>{{ store.name }}</p>
              <p>{{ store.address }}</p>
              <p>{{ store.email }} · {{ store.phone }}</p>
              <p>{{ 'Matricule fiscal' | t }} : {{ store.taxId }}</p>
            </div>
            <div class="meta">
              <h1>{{ 'Facture' | t }}</h1>
              <dl>
                <dt>{{ 'N° de facture' | t }}</dt>
                <dd>{{ number(o) }}</dd>
                <dt>{{ 'Date' | t }}</dt>
                <dd>{{ o.createdAt | date: 'dd/MM/yyyy' }}</dd>
                <dt>{{ 'Commande' | t }}</dt>
                <dd>{{ o.reference }}</dd>
              </dl>
            </div>
          </header>

          <section class="parties">
            <div>
              <h2>{{ 'Facturé et livré à' | t }}</h2>
              <p class="strong">{{ o.shippingName }}</p>
              <p>{{ o.shippingAddress }}</p>
              <p>{{ o.shippingPhone }}</p>
              @if (email(); as e) {
                <p>{{ e }}</p>
              }
            </div>
            <div>
              <h2>{{ 'Paiement' | t }}</h2>
              <p class="strong">{{ paymentLabels[o.paymentMethod] | t }}</p>
              <p>{{ paymentStatusLabels[o.paymentStatus] | t }}</p>
              @if (o.paidAt && o.paymentStatus === 'PAID') {
                <p>{{ 'Réglée le {date}' | t: { date: (o.paidAt | date: 'dd/MM/yyyy') } }}</p>
              }
            </div>
          </section>

          <table>
            <thead>
              <tr>
                <th>{{ 'Désignation' | t }}</th>
                <th class="num">{{ 'Qté' | t }}</th>
                <th class="num">{{ 'P.U. TTC' | t }}</th>
                <th class="num">{{ 'Total TTC' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of o.items; track item.id) {
                <tr>
                  <td>
                    {{ item.productName | productName }}
                    <small>{{ item.productSku }}</small>
                  </td>
                  <td class="num">{{ item.quantity }}</td>
                  <td class="num">{{ item.unitPrice | tnd }}</td>
                  <td class="num">{{ item.lineTotal | tnd }}</td>
                </tr>
              }
              <tr>
                <td>{{ 'Frais de livraison' | t }}</td>
                <td class="num">1</td>
                <td class="num">{{ o.shippingFee | tnd }}</td>
                <td class="num">{{ o.shippingFee | tnd }}</td>
              </tr>
            </tbody>
          </table>

          <dl class="totals">
            <div>
              <dt>{{ 'Total HT' | t }}</dt>
              <dd>{{ vat(o).ht | tnd }}</dd>
            </div>
            <div>
              <dt>{{ 'TVA ({rate} %)' | t: { rate: vatRate } }}</dt>
              <dd>{{ vat(o).vat | tnd }}</dd>
            </div>
            <div class="grand">
              <dt>{{ 'Total TTC' | t }}</dt>
              <dd>{{ o.total | tnd }}</dd>
            </div>
          </dl>

          <footer class="legal">
            <p>
              {{
                'Montants en dinars tunisiens (TND), TVA incluse. Merci pour votre achat chez ByteBazaar.'
                  | t
              }}
            </p>
            <p>{{ store.name }} · {{ store.email }}</p>
          </footer>
        </article>
      } @else if (failed()) {
        <div class="card empty">
          <p>{{ 'Facture introuvable.' | t }}</p>
        </div>
      } @else {
        <div class="sheet loading"></div>
      }
    </div>
  `,
  styles: `
    /* Couleurs du papier : identiques en thème clair et sombre */
    .sheet {
      --ink: #14182b;
      --ink-2: #4b5268;
      --line: #e3e6ef;
      --brand: #3d5afe;
      max-width: 820px;
      margin: 0 auto;
      padding: 3rem 3.2rem;
      background: #fff;
      color: var(--ink);
      border-radius: var(--r-lg);
      box-shadow: var(--shadow-lift);
      font-size: var(--fs-md);
    }
    .sheet.loading {
      min-height: 900px;
      opacity: 0.5;
    }
    .page {
      padding-block: 1.5rem 3rem;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 1.2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--muted);
      font-size: var(--fs-sm);
    }
    .back:hover {
      color: var(--accent);
    }
    .void {
      margin: -1rem 0 1.6rem;
      padding: 0.6rem 1rem;
      border: 2px solid #d0263f;
      border-radius: 8px;
      color: #d0263f;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 2rem;
      padding-bottom: 1.6rem;
      border-bottom: 2px solid var(--ink);
    }
    .seller p,
    .parties p {
      margin: 0.1rem 0;
      color: var(--ink-2);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.7rem;
      font-family: var(--font-display);
      font-size: var(--fs-xl);
      font-weight: 700;
    }
    .brand b {
      color: var(--brand);
    }
    .mark {
      flex: none;
      width: 34px;
      height: 34px;
    }
    .meta {
      text-align: right;
    }
    .meta h1 {
      margin: 0 0 0.8rem;
      font-size: var(--fs-3xl);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .meta dl {
      display: grid;
      grid-template-columns: auto auto;
      gap: 0.2rem 1rem;
      margin: 0;
    }
    .meta dt {
      color: var(--ink-2);
    }
    .meta dd {
      margin: 0;
      font-weight: 700;
    }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      padding: 1.6rem 0;
    }
    .parties h2 {
      margin: 0 0 0.4rem;
      font-size: var(--fs-xs);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-2);
    }
    .strong {
      font-weight: 700;
      color: var(--ink) !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      padding: 0.6rem 0.5rem;
      background: #f3f5fa;
      color: var(--ink-2);
      font-size: var(--fs-xs);
      font-weight: 800;
      letter-spacing: 0.06em;
      text-align: left;
      text-transform: uppercase;
    }
    td {
      padding: 0.7rem 0.5rem;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    td small {
      display: block;
      color: var(--ink-2);
      font-size: var(--fs-xs);
    }
    .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .totals {
      width: min(320px, 100%);
      margin: 1.2rem 0 0 auto;
      display: grid;
      gap: 0.3rem;
    }
    .totals div {
      display: flex;
      justify-content: space-between;
    }
    .totals dt {
      color: var(--ink-2);
    }
    .totals dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .totals .grand {
      margin-top: 0.4rem;
      padding: 0.7rem 0.8rem;
      border-radius: 8px;
      background: var(--ink);
      color: #fff;
      font-weight: 800;
      font-size: var(--fs-lg);
    }
    .totals .grand dt {
      color: #fff;
    }
    .legal {
      margin-top: 2.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--line);
      color: var(--ink-2);
      font-size: var(--fs-xs);
      text-align: center;
    }
    .legal p {
      margin: 0.15rem 0;
    }
    .empty {
      max-width: 820px;
      margin: 0 auto;
      padding: 2rem;
      text-align: center;
    }

    @media (max-width: 640px) {
      .sheet {
        padding: 1.6rem 1.2rem;
        border-radius: var(--r-md);
      }
      .top,
      .parties {
        display: block;
      }
      .meta {
        text-align: left;
        margin-top: 1.2rem;
      }
      .parties > div + div {
        margin-top: 1.2rem;
      }
      th:nth-child(3),
      td:nth-child(3) {
        display: none;
      }
    }

    @media print {
      .page {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .sheet {
        max-width: none;
        padding: 0;
        border-radius: 0;
        box-shadow: none;
      }
      th {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .totals .grand {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `,
})
export class InvoicePage {
  private readonly ordersApi = inject(OrdersApi);
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  /** true sur la route d'administration (data.admin) */
  readonly admin = input(false);

  readonly store = STORE;
  readonly vatRate = Math.round(VAT_RATE * 100);
  readonly paymentLabels = PAYMENT_LABELS;
  readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;

  private readonly result = toSignal(
    toObservable(computed(() => ({ id: Number(this.id()), admin: this.admin() }))).pipe(
      switchMap(({ id, admin }) =>
        (admin ? this.adminApi.getAdminOrderDetails(id) : this.ordersApi.getOrder(id)).pipe(
          catchError(() => of(null)),
        ),
      ),
    ),
  );

  readonly order = computed(() => (this.result() as Order | null | undefined) ?? null);
  readonly failed = computed(() => this.result() === null);

  readonly email = computed(() => {
    const o = this.result() as (Order & { user?: { email: string } }) | null | undefined;
    return o?.user?.email ?? (this.admin() ? null : (this.auth.user()?.email ?? null));
  });

  readonly backLink = computed(() =>
    this.admin() ? ['/admin/commandes'] : ['/commandes', this.id()],
  );

  number(o: Order) {
    return `FAC-${o.reference.replace(/^BB-/, '')}`;
  }

  vat(o: Order) {
    return vatBreakdown(o.total);
  }

  print() {
    window.print();
  }
}
