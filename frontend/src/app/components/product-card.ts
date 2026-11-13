import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductListItem } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { LocalNamePipe, ProductNamePipe, TPipe } from '../core/i18n';
import { CartStateService } from '../core/cart.service';
import { ToastService } from '../core/toast.service';
import { apiErrors } from '../core/utils';
import { Icon } from './icon';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, TndPipe, Icon, TPipe, LocalNamePipe, ProductNamePipe],
  template: `
    <div class="wrap">
      <a class="card product" [routerLink]="['/produits', product().slug]">
        <div class="ph">
          @if (product().image; as img) {
            <img
              [src]="img.url"
              [alt]="img.altText ?? product().name | productName"
              loading="lazy"
            />
          } @else {
            <span>{{ product().brand.name }}</span>
          }
        </div>
        <div class="body">
          <small class="muted"
            >{{ product().brand.name }} · {{ product().category | localName }}</small
          >
          <h3>{{ product().name | productName }}</h3>
          <div class="row">
            <strong class="price">{{ product().price | tnd }}</strong>
            <span class="badge" [class.ok]="product().isAvailable">
              {{ (product().isAvailable ? 'En stock' : 'Rupture') | t }}
            </span>
          </div>
        </div>
      </a>

      <!-- Ajout rapide au panier (au survol de la carte) : hors du lien pour ne pas ouvrir la fiche -->
      @if (product().isAvailable) {
        <button
          type="button"
          class="quick-add"
          [class.busy]="state() === 'busy'"
          [class.done]="state() === 'done'"
          [disabled]="state() === 'busy'"
          (click)="quickAdd()"
          [title]="'Ajouter au panier' | t"
          [attr.aria-label]="('Ajouter au panier' | t) + ' : ' + (product().name | productName)"
        >
          <app-icon [name]="state() === 'done' ? 'check' : 'cart'" [size]="15" [stroke]="2.2" />
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .wrap {
      position: relative;
      height: 100%;
    }
    .product {
      display: block;
      padding: 0.6rem;
      height: 100%;
      transition:
        box-shadow 0.25s,
        transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
        border-color 0.25s;
    }
    .wrap:hover .product {
      box-shadow: var(--shadow-lift);
      transform: translateY(-4px);
      border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    }
    .ph {
      position: relative;
      border-radius: var(--r-xl);
    }
    .ph img {
      transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    .wrap:hover .ph img {
      transform: scale(1.06);
    }
    h3 {
      transition: color 0.2s;
    }
    .wrap:hover h3 {
      color: var(--accent);
    }
    .body {
      padding: 0.9rem 0.6rem 0.6rem;
    }
    h3 {
      font-size: var(--fs-base);
      font-weight: 600;
      margin: 0.25rem 0 0.8rem;
      min-height: 2.5em;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .price {
      color: var(--accent);
      font-family: var(--font-display);
      font-size: var(--fs-lg);
    }

    .quick-add {
      position: absolute;
      top: 1.05rem;
      right: 1.05rem;
      z-index: 2;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      border-radius: 50%;
      border: 0;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--accent) 85%, #fff),
        var(--accent)
      );
      color: var(--on-accent);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        0 8px 18px -8px color-mix(in srgb, var(--accent) 85%, transparent);
      opacity: 0;
      transform: translateY(-4px) scale(0.7);
      transition:
        opacity 0.2s,
        transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1),
        box-shadow 0.2s,
        background 0.2s;
    }
    .wrap:hover .quick-add,
    .quick-add:focus-visible,
    .quick-add.busy,
    .quick-add.done {
      opacity: 1;
      transform: translateY(-4px);
    }
    .quick-add:hover {
      transform: translateY(-4px) scale(1.12);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        0 10px 22px -8px color-mix(in srgb, var(--pink) 70%, transparent);
    }
    .quick-add:active {
      transform: translateY(-4px) scale(0.94);
    }
    .quick-add.busy {
      animation: pulse 0.9s ease-in-out infinite;
    }
    .quick-add.done {
      background: var(--green);
      color: #fff;
      animation: pop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
    }
    @keyframes pulse {
      50% {
        opacity: 0.6;
      }
    }
    @keyframes pop {
      40% {
        transform: translateY(-4px) scale(1.25);
      }
    }
    /* Écrans tactiles (sans survol) : le bouton reste visible */
    @media (hover: none) {
      .quick-add {
        opacity: 1;
        transform: translateY(-4px);
      }
    }
  `,
})
export class ProductCard {
  product = input.required<ProductListItem>();

  private readonly cart = inject(CartStateService);
  private readonly toast = inject(ToastService);
  readonly state = signal<'idle' | 'busy' | 'done'>('idle');

  quickAdd() {
    const p = this.product();
    this.state.set('busy');
    this.cart
      .addItem({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        stockQuantity: p.stockQuantity,
        image: p.image,
      })
      .subscribe({
        next: () => {
          this.state.set('done');
          this.toast.added(p.name, p.image?.url);
          setTimeout(() => this.state.set('idle'), 1400);
        },
        error: (e) => {
          this.state.set('idle');
          this.toast.error(apiErrors(e)[0]);
        },
      });
  }
}
