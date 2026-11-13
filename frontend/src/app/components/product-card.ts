import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductListItem } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { LocalNamePipe, ProductNamePipe, TPipe } from '../core/i18n';
import { Icon } from './icon';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, TndPipe, Icon, TPipe, LocalNamePipe, ProductNamePipe],
  template: `
    <a class="card product" [routerLink]="['/produits', product().slug]">
      <div class="ph">
        @if (product().image; as img) {
          <img [src]="img.url" [alt]="(img.altText ?? product().name) | productName" loading="lazy" />
        } @else {
          <span>{{ product().brand.name }}</span>
        }
        <span class="go" aria-hidden="true"><app-icon name="arrowUpRight" [size]="16" [stroke]="2.2" /></span>
      </div>
      <div class="body">
        <small class="muted">{{ product().brand.name }} · {{ product().category | localName }}</small>
        <h3>{{ product().name | productName }}</h3>
        <div class="row">
          <strong class="price">{{ product().price | tnd }}</strong>
          <span class="badge" [class.ok]="product().isAvailable">
            {{ (product().isAvailable ? 'En stock' : 'Rupture') | t }}
          </span>
        </div>
      </div>
    </a>
  `,
  styles: `
    .product { display: block; padding: 0.6rem; height: 100%; transition: box-shadow 0.25s, transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1), border-color 0.25s; }
    .product:hover { box-shadow: var(--shadow-lift); transform: translateY(-4px); border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }
    .ph { position: relative; border-radius: var(--r-xl); }
    .ph img { transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .product:hover .ph img { transform: scale(1.06); }
    /* Pastille « voir le produit » qui apparaît au survol */
    .go {
      position: absolute; top: 0.6rem; right: 0.6rem; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
      background: var(--accent); color: var(--on-accent); box-shadow: 0 8px 16px -8px color-mix(in srgb, var(--accent) 80%, transparent);
      opacity: 0; transform: scale(0.6) rotate(-45deg); transition: opacity 0.2s, transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1);
    }
    .product:hover .go, .product:focus-visible .go { opacity: 1; transform: none; }
    h3 { transition: color 0.2s; }
    .product:hover h3 { color: var(--accent); }
    .body { padding: 0.9rem 0.6rem 0.6rem; }
    h3 { font-size: var(--fs-base); font-weight: 600; margin: 0.25rem 0 0.8rem; min-height: 2.5em; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .price { color: var(--accent); font-family: var(--font-display); font-size: var(--fs-lg); }
  `,
})
export class ProductCard {
  product = input.required<ProductListItem>();
}