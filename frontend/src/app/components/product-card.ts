import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductListItem } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, TndPipe],
  template: `
    <a class="card product" [routerLink]="['/produits', product().slug]">
      <div class="ph">
        @if (product().image; as img) {
          <img [src]="img.url" [alt]="img.altText ?? product().name" loading="lazy" />
        } @else {
          <span>{{ product().brand.name }}</span>
        }
      </div>
      <div class="body">
        <small class="muted">{{ product().brand.name }} · {{ product().category.nameFr }}</small>
        <h3>{{ product().name }}</h3>
        <div class="row">
          <strong class="price">{{ product().price | tnd }}</strong>
          <span class="badge" [class.ok]="product().isAvailable">
            {{ product().isAvailable ? 'En stock' : 'Rupture' }}
          </span>
        </div>
      </div>
    </a>
  `,
  styles: `
    .product { display: block; padding: 0.6rem; height: 100%; transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s; }
    .product:hover { box-shadow: var(--shadow-lift); transform: translateY(-3px); border-color: var(--accent); }
    .ph { border-radius: var(--r-xl); }
    .body { padding: 0.9rem 0.6rem 0.6rem; }
    h3 { font-size: var(--fs-base); font-weight: 600; margin: 0.25rem 0 0.8rem; min-height: 2.5em; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .price { color: var(--accent); font-family: var(--font-display); font-size: var(--fs-lg); }
  `,
})
export class ProductCard {
  product = input.required<ProductListItem>();
}