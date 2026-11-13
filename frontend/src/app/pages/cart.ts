import { Component, inject, signal } from '@angular/core';
import { Icon } from '../components/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { CartStateService } from '../core/cart.service';
import { SHIPPING_FEE } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { ProductNamePipe, TPipe } from '../core/i18n';

@Component({
  selector: 'app-cart-page',
  imports: [Icon, RouterLink, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="container page">
      <h2>{{ 'Mon Panier' | t }}</h2>

      @if (cartState.cart(); as c) {
        @if (c.items.length) {
          <div class="cart-layout">
            <div class="card items-list">
              @for (item of c.items; track item.id) {
                <div class="item-row">
                  <a
                    class="item-info"
                    [routerLink]="['/produits', item.product.slug]"
                    [title]="'Voir la fiche du produit' | t"
                  >
                    @if (item.product.image?.url) {
                      <img
                        [src]="item.product.image?.url"
                        [alt]="item.product.image?.altText || item.product.name | productName"
                        class="product-thumb"
                      />
                    } @else {
                      <div class="product-thumb-placeholder"></div>
                    }

                    <div class="item-details">
                      <h4>{{ item.product.name | productName }}</h4>
                      <span class="muted">{{
                        "{price} l'unité" | t: { price: (item.unitPrice | tnd) }
                      }}</span>
                    </div>
                  </a>

                  <div class="qty-controls">
                    <button class="btn-qty" (click)="updateQty(item.id, item.quantity - 1)">
                      -
                    </button>
                    <span>{{ item.quantity }}</span>
                    <button class="btn-qty" (click)="updateQty(item.id, item.quantity + 1)">
                      +
                    </button>
                  </div>

                  <div class="item-total">
                    <strong>{{ item.lineTotal | tnd }}</strong>
                    <button
                      class="btn-del"
                      (click)="removeItem(item.id)"
                      [attr.aria-label]="'Retirer l\\'article' | t"
                      [title]="'Retirer' | t"
                    >
                      <app-icon name="trash" [size]="17" />
                    </button>
                  </div>
                </div>
              }
            </div>

            <div class="card summary">
              <h3>{{ 'Récapitulatif' | t }}</h3>
              <div class="sum-row">
                <span>{{ 'Sous-total' | t }}</span>
                <strong>{{ c.total | tnd }}</strong>
              </div>
              <div class="sum-row">
                <span>{{ 'Frais de livraison' | t }}</span>
                <span>{{ shipping | tnd }}</span>
              </div>
              <hr class="divider" />
              <div class="sum-row total">
                <span>{{ 'Total' | t }}</span>
                <strong>{{ c.total + shipping | tnd }}</strong>
              </div>
              @if (auth.isLoggedIn()) {
                <a routerLink="/checkout" class="btn primary full">{{
                  'Passer la commande' | t
                }}</a>
              } @else {
                <a
                  routerLink="/connexion"
                  [queryParams]="{ redirect: '/checkout' }"
                  class="btn primary full"
                  >{{ 'Se connecter pour commander' | t }}</a
                >
                <p class="muted note">
                  {{ 'Ton panier est conservé : tu le retrouveras après connexion.' | t }}
                </p>
              }

              <div class="clear-zone">
                @if (!confirmClear()) {
                  <button type="button" class="clear-btn" (click)="confirmClear.set(true)">
                    <app-icon name="trash" [size]="15" /> {{ 'Vider le panier' | t }}
                  </button>
                } @else {
                  <div class="clear-confirm" role="alert">
                    <span>{{ 'Retirer tous les articles du panier ?' | t }}</span>
                    <div class="clear-actions">
                      <button
                        type="button"
                        class="btn small"
                        (click)="confirmClear.set(false)"
                        [disabled]="clearing()"
                      >
                        {{ 'Annuler' | t }}
                      </button>
                      <button
                        type="button"
                        class="btn small danger"
                        (click)="clearCart()"
                        [disabled]="clearing()"
                      >
                        <app-icon name="trash" [size]="14" /> {{ 'Vider' | t }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <div class="card empty">
            <p>{{ 'Votre panier est vide.' | t }}</p>
            <a routerLink="/produits" class="btn primary">{{ 'Découvrir nos produits' | t }}</a>
          </div>
        }
      } @else {
        <p class="muted">{{ 'Chargement du panier...' | t }}</p>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: 2rem;
    }
    .cart-layout {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 1.5rem;
      margin-top: 1rem;
    }
    .items-list {
      padding: 1rem;
    }
    .item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-block: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .item-row:last-child {
      border-bottom: none;
    }

    .item-info {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
      color: inherit;
      border-radius: var(--r-md);
    }
    .item-info .product-thumb {
      transition:
        transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1),
        border-color 0.2s;
    }
    .item-info h4 {
      transition: color 0.2s;
    }
    .item-info:hover h4 {
      color: var(--accent);
    }
    .item-info:hover .product-thumb {
      transform: scale(1.06);
      border-color: var(--accent);
    }
    .product-thumb {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: var(--surface-2);
      flex-shrink: 0;
    }
    .product-thumb-placeholder {
      width: 60px;
      height: 60px;
      border-radius: var(--r-sm);
      background: var(--surface-2);
      border: 1px solid var(--border);
      flex-shrink: 0;
    }
    .item-details {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .item-details h4 {
      margin: 0;
      font-size: var(--fs-base);
    }

    .qty-controls {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-inline: 1.5rem;
    }
    .btn-qty {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-weight: 700;
      box-shadow: var(--shadow-sm);
      transition:
        border-color 0.15s,
        color 0.15s,
        background 0.15s,
        transform 0.15s;
    }
    .btn-qty:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-soft);
    }
    .btn-qty:active {
      transform: scale(0.92);
    }
    .item-total {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .btn-del {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid transparent;
      background: none;
      color: var(--muted);
      cursor: pointer;
      transition:
        color 0.15s,
        background 0.15s,
        border-color 0.15s;
    }
    .btn-del:hover {
      color: var(--red);
      background: color-mix(in srgb, var(--red) 9%, transparent);
      border-color: color-mix(in srgb, var(--red) 25%, transparent);
    }
    .summary {
      padding: 1.5rem;
      height: fit-content;
    }
    .sum-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.8rem;
    }
    .sum-row.total {
      font-size: var(--fs-xl);
      color: var(--accent);
      margin-top: 0.8rem;
    }
    .divider {
      border: 0;
      border-top: 1px solid var(--border);
      margin-block: 1rem;
    }
    .full {
      width: 100%;
      text-align: center;
      margin-top: 1rem;
    }
    .note {
      font-size: var(--fs-md);
      text-align: center;
      margin: 0.8rem 0 0;
    }
    .clear-zone {
      margin-top: 1rem;
      padding-top: 0.9rem;
      border-top: 1px dashed var(--border);
      display: grid;
    }
    .clear-btn {
      justify-self: center;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.9rem;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font-size: var(--fs-sm);
      font-weight: 700;
      transition:
        color 0.15s,
        background 0.15s,
        border-color 0.15s;
    }
    .clear-btn:hover {
      color: var(--red);
      background: color-mix(in srgb, var(--red) 9%, transparent);
      border-color: color-mix(in srgb, var(--red) 25%, transparent);
    }
    .clear-confirm {
      display: grid;
      gap: 0.6rem;
      justify-items: center;
      text-align: center;
      font-size: var(--fs-sm);
      font-weight: 600;
      animation: confirm-in 0.25s ease;
    }
    @keyframes confirm-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    .clear-actions {
      display: flex;
      gap: 0.5rem;
    }
    .empty {
      padding: 3rem;
      text-align: center;
      margin-top: 1rem;
    }
    @media (max-width: 800px) {
      .cart-layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CartPage {
  readonly cartState = inject(CartStateService);
  readonly auth = inject(AuthService);
  readonly shipping = SHIPPING_FEE;
  readonly confirmClear = signal(false);
  readonly clearing = signal(false);

  clearCart() {
    this.clearing.set(true);
    this.cartState.clearAll().subscribe({
      next: () => {
        this.clearing.set(false);
        this.confirmClear.set(false);
      },
      error: () => this.clearing.set(false),
    });
  }

  updateQty(itemId: number, newQty: number) {
    this.cartState.updateItem(itemId, newQty).subscribe();
  }

  removeItem(itemId: number) {
    this.cartState.removeItem(itemId).subscribe();
  }
}
