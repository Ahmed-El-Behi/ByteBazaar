import { Component, inject, input } from '@angular/core';
import { Icon } from '../components/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CartApi, Order, PAYMENT_LABELS, STATUS_LABELS } from '../core/cart-api';
import { TndPipe } from '../core/tnd.pipe';

@Component({
  selector: 'app-order-detail-page',
  imports: [Icon, RouterLink, TndPipe],
  template: `
    <div class="container page">
      @if (order(); as o) {
        <div class="card confirm-box">
          <span class="icon"><app-icon name="checkCircle" [size]="30" [stroke]="2" /></span>
          <h2>Commande confirmée !</h2>
          <p class="muted">Référence : <strong>{{ o.reference }}</strong></p>

          <div class="details">
            <div class="row"><span>Statut :</span> <strong>{{ status[o.status] ?? o.status }}</strong></div>
            <div class="row"><span>Paiement :</span> {{ payment[o.paymentMethod] ?? o.paymentMethod }}</div>
            <div class="row"><span>Destinataire :</span> {{ o.shippingName }} ({{ o.shippingPhone }})</div>
            <div class="row"><span>Adresse :</span> {{ o.shippingAddress }}</div>
          </div>

          <table class="items-table">
            @for (item of o.items; track item.id) {
              @let imgUrl = item.product?.image?.url || item.imageUrl;
              <tr>
                <td>
                  <div class="product-col">
                    @if (imgUrl) {
                      <img 
                        [src]="imgUrl" 
                        [alt]="item.productName" 
                        class="item-thumb" 
                      />
                    } @else {
                      <div class="item-thumb-placeholder"></div>
                    }
                    <span class="item-name">{{ item.productName }} <small class="muted">x{{ item.quantity }}</small></span>
                  </div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  <strong>{{ item.lineTotal | tnd }}</strong>
                </td>
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
    .icon { font-size: var(--fs-5xl); }
    .details { text-align: left; background: var(--surface-2); padding: 1rem; border-radius: var(--r-md); margin-block: 1rem; }
    .row { margin-bottom: 0.4rem; }
    
    .items-table { width: 100%; border-collapse: collapse; margin-block: 1rem; text-align: left; }
    .items-table td { padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
    
    .product-col { display: flex; align-items: center; gap: 0.8rem; }
    .item-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface-2); flex-shrink: 0; }
    .item-thumb-placeholder { width: 44px; height: 44px; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface-2); flex-shrink: 0; }
    .item-name { font-size: var(--fs-ui); line-height: 1.3; }

    .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; font-size: var(--fs-lg); }
    .price { color: var(--accent); }
  `,
})
export class OrderDetailPage {
  private api = inject(CartApi);
  id = input.required<string>();
  readonly status = STATUS_LABELS;
  readonly payment = PAYMENT_LABELS;

  readonly order = toSignal<Order>(
    toObservable(this.id).pipe(
      switchMap((id) => this.api.getOrder(Number(id)))
    )
  );
}