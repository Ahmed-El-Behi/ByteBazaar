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
    .product { display: block; overflow: hidden; transition: border-color 0.15s, transform 0.15s; height: 100%; }
    .product:hover { border-color: var(--orange); transform: translateY(-2px); }
    .body { padding: 0.9rem 1rem 1rem; }
    h3 { font-size: 1rem; margin: 0.25rem 0 0.7rem; min-height: 2.4em; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .price { color: var(--orange); font-size: 1.05rem; }
  `,
})
export class ProductCard {
  product = input.required<ProductListItem>();
}