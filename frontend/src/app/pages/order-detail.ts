import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CartApi, Order } from '../core/cart-api';
import { TndPipe } from '../core/tnd.pipe';

@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, TndPipe],
  template: `
    <div class="container page">
      @if (order(); as o) {
        <div class="card confirm-box">
          <span class="icon">✅</span>
          <h2>Commande confirmée !</h2>
          <p class="muted">Référence : <strong>{{ o.reference }}</strong></p>

          <div class="details">
            <div class="row"><span>Statut :</span> <strong>{{ o.status }}</strong></div>
            <div class="row"><span>Destinataire :</span> {{ o.shippingName }} ({{ o.shippingPhone }})</div>
            <div class="row"><span>Adresse :</span> {{ o.shippingAddress }}</div>
          </div>

          <table class="items-table">
            @for (item of o.items; track item.id) {
              <tr>
                <td>{{ item.productName }} x{{ item.quantity }}</td>
                <td style="text-align: right;">{{ item.lineTotal | tnd }}</td>
              </tr>
            }
          </table>

          <div class="total-row">
            <span>Total réglé (Livraison incluse) :</span>
            <strong class="price">{{ o.total | tnd }}</strong>
          </div>

          <a routerLink="/produits" class="btn primary" style="margin-top: 1.5rem;">Continuer mes achats</a>
        </div>
      } @else {
        <p class="muted">Chargement de la commande...</p>
      }
    </div>
  `,
  styles: `
    .page { display: flex; justify-content: center; padding-block: 3rem; }
    .confirm-box { width: min(520px, 100%); padding: 2rem; text-align: center; }
    .icon { font-size: 3rem; }
    .details { text-align: left; background: var(--surface-2); padding: 1rem; border-radius: 8px; margin-block: 1rem; }
    .row { margin-bottom: 0.4rem; }
    .items-table { width: 100%; border-collapse: collapse; margin-block: 1rem; text-align: left; }
    .items-table td { padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
    .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; font-size: 1.1rem; }
    .price { color: var(--orange); }
  `,
})
export class OrderDetailPage {
  private api = inject(CartApi);
  id = input.required<string>();

  readonly order = toSignal<Order>(
    toObservable(this.id).pipe(switchMap((id) => this.api.getOrder(Number(id)))),
  );
}