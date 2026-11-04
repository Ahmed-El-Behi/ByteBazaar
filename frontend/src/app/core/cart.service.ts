import { Injectable, computed, inject, signal } from '@angular/core';
import { CartApi, Cart } from './cart-api';
import { AuthService } from './auth-service';
import { catchError, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CartStateService {
  private api = inject(CartApi);
  private auth = inject(AuthService);

  readonly cart = signal<Cart | null>(null);
  readonly itemCount = computed(() => this.cart()?.itemCount ?? 0);
  readonly total = computed(() => this.cart()?.total ?? 0);

  constructor() {
    if (this.auth.isLoggedIn()) {
      this.loadCart();
    }
  }

  loadCart() {
    if (!this.auth.isLoggedIn()) return;
    this.api.getCart().pipe(
      tap((cart) => this.cart.set(cart)),
      catchError(() => of(null)),
    ).subscribe();
  }

  addItem(productId: number, quantity = 1) {
    return this.api.addItem(productId, quantity).pipe(
      tap((cart) => this.cart.set(cart)),
    );
  }

  updateItem(itemId: number, quantity: number) {
    return this.api.updateItem(itemId, quantity).pipe(
      tap((cart) => this.cart.set(cart)),
    );
  }

  removeItem(itemId: number) {
    return this.api.removeItem(itemId).pipe(
      tap((cart) => this.cart.set(cart)),
    );
  }

  clearLocal() {
    this.cart.set(null);
  }
}