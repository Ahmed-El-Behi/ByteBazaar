import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStateService } from '../core/cart.service';
import { TndPipe } from '../core/tnd.pipe';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, TndPipe],
  template: `
    <div class="container page">
      <h2>Mon Panier</h2>

      @if (cartState.cart(); as c) {
        @if (c.items.length) {
          <div class="cart-layout">
            <div class="card items-list">
              @for (item of c.items; track item.id) {
                <div class="item-row">
                  <div class="item-info">
                    <h4>{{ item.product.name }}</h4>
                    <span class="muted">{{ item.unitPrice | tnd }} l'unité</span>
                  </div>

                  <div class="qty-controls">
                    <button class="btn-qty" (click)="updateQty(item.id, item.quantity - 1)">-</button>
                    <span>{{ item.quantity }}</span>
                    <button class="btn-qty" (click)="updateQty(item.id, item.quantity + 1)">+</button>
                  </div>

                  <div class="item-total">
                    <strong>{{ item.lineTotal | tnd }}</strong>
                    <button class="btn-del" (click)="removeItem(item.id)">🗑️</button>
                  </div>
                </div>
              }
            </div>

            <div class="card summary">
              <h3>Récapitulatif</h3>
              <div class="sum-row">
                <span>Sous-total</span>
                <strong>{{ c.total | tnd }}</strong>
              </div>
              <div class="sum-row">
                <span>Frais de livraison</span>
                <span>7,000 TND</span>
              </div>
              <hr class="divider" />
              <div class="sum-row total">
                <span>Total</span>
                <strong>{{ (c.total + 7) | tnd }}</strong>
              </div>
              <a routerLink="/checkout" class="btn primary full">Passer la commande</a>
            </div>
          </div>
        } @else {
          <div class="card empty">
            <p>Votre panier est vide.</p>
            <a routerLink="/produits" class="btn primary">Découvrir nos produits</a>
          </div>
        }
      } @else {
        <p class="muted">Chargement du panier...</p>
      }
    </div>
  `,
  styles: `
    .page { padding-block: 2rem; }
    .cart-layout { display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem; margin-top: 1rem; }
    .items-list { padding: 1rem; }
    .item-row { display: flex; align-items: center; justify-content: space-between; padding-block: 1rem; border-bottom: 1px solid var(--border); }
    .item-row:last-child { border-bottom: none; }
    .item-info { flex: 1; }
    .item-info h4 { margin: 0 0 0.2rem; font-size: 1rem; }
    .qty-controls { display: flex; align-items: center; gap: 0.6rem; margin-inline: 1.5rem; }
    .btn-qty { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer; }
    .item-total { display: flex; align-items: center; gap: 1rem; }
    .btn-del { background: none; border: none; cursor: pointer; font-size: 1.1rem; }
    .summary { padding: 1.5rem; height: fit-content; }
    .sum-row { display: flex; justify-content: space-between; margin-bottom: 0.8rem; }
    .sum-row.total { font-size: 1.2rem; color: var(--orange); margin-top: 0.8rem; }
    .divider { border: 0; border-top: 1px solid var(--border); margin-block: 1rem; }
    .full { width: 100%; text-align: center; margin-top: 1rem; }
    .empty { padding: 3rem; text-align: center; margin-top: 1rem; }
    @media (max-width: 800px) { .cart-layout { grid-template-columns: 1fr; } }
  `,
})
export class CartPage {
  readonly cartState = inject(CartStateService);

  updateQty(itemId: number, newQty: number) {
    this.cartState.updateItem(itemId, newQty).subscribe();
  }

  removeItem(itemId: number) {
    this.cartState.removeItem(itemId).subscribe();
  }
}