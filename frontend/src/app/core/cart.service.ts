import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { EMPTY, Observable, catchError, concatMap, finalize, from, of, tap, throwError, toArray } from 'rxjs';
import { AuthService } from './auth-service';
import { Cart, CartApi } from './cart-api';

const GUEST_KEY = 'bytebazaar_guest_cart';

export interface CartProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  stockQuantity: number;
  image: { url: string; altText: string | null } | null;
}

// Panier d'un visiteur non connecté : conservé dans le navigateur, puis fusionné à la connexion
interface GuestItem {
  productId: number;
  quantity: number;
  name: string;
  slug: string;
  price: number;
  stockQuantity: number;
  image: { url: string; altText: string | null } | null;
}

function readGuest(): GuestItem[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]');
    return Array.isArray(data)
      ? data.filter((i): i is GuestItem => typeof i?.productId === 'number' && typeof i?.quantity === 'number')
      : [];
  } catch {
    return [];
  }
}

function writeGuest(items: GuestItem[]): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(items));
  } catch {
    // stockage indisponible : le panier invité ne sera pas conservé
  }
}

// Même forme que la réponse de l'API, pour que les pages n'aient rien à distinguer
function toCart(items: GuestItem[]): Cart {
  const lines = items.map((i) => ({
    id: i.productId,
    productId: i.productId,
    quantity: i.quantity,
    unitPrice: i.price,
    lineTotal: Math.round(i.price * i.quantity * 1000) / 1000,
    product: {
      name: i.name,
      slug: i.slug,
      stockQuantity: i.stockQuantity,
      isAvailable: i.stockQuantity >= i.quantity,
      image: i.image,
    },
  }));
  return {
    id: 0,
    items: lines,
    total: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

@Injectable({ providedIn: 'root' })
export class CartStateService {
  private api = inject(CartApi);
  private auth = inject(AuthService);

  readonly cart = signal<Cart | null>(null);
  readonly itemCount = computed(() => this.cart()?.itemCount ?? 0);
  readonly total = computed(() => this.cart()?.total ?? 0);

  constructor() {
    // Connecté : panier du serveur (après fusion du panier invité). Déconnecté : panier local.
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => (loggedIn ? this.onLogin() : this.cart.set(toCart(readGuest()))));
    });
  }

  private onLogin() {
    const guest = readGuest();
    if (!guest.length) {
      this.loadCart();
      return;
    }
    from(guest)
      .pipe(
        concatMap((g) => this.api.addItem(g.productId, g.quantity).pipe(catchError(() => EMPTY))),
        toArray(),
        finalize(() => {
          writeGuest([]);
          this.loadCart();
        }),
      )
      .subscribe();
  }

  loadCart() {
    if (!this.auth.isLoggedIn()) return;
    this.api
      .getCart()
      .pipe(
        tap((cart) => this.cart.set(cart)),
        catchError(() => of(null)),
      )
      .subscribe();
  }

  addItem(product: CartProduct, quantity = 1): Observable<Cart> {
    if (this.auth.isLoggedIn()) {
      return this.api.addItem(product.id, quantity).pipe(tap((cart) => this.cart.set(cart)));
    }

    const items = readGuest();
    const existing = items.find((i) => i.productId === product.id);
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > product.stockQuantity) {
      return throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: 'Quantité maximale atteinte pour ce produit.' } }),
      );
    }

    if (existing) {
      existing.quantity = newQty;
      existing.price = product.price;
      existing.stockQuantity = product.stockQuantity;
    } else {
      items.push({
        productId: product.id,
        quantity,
        name: product.name,
        slug: product.slug,
        price: product.price,
        stockQuantity: product.stockQuantity,
        image: product.image,
      });
    }
    return this.saveGuest(items);
  }

  updateItem(itemId: number, quantity: number): Observable<Cart> {
    if (this.auth.isLoggedIn()) {
      return this.api.updateItem(itemId, quantity).pipe(tap((cart) => this.cart.set(cart)));
    }
    const items = readGuest()
      .map((i) => (i.productId === itemId ? { ...i, quantity: Math.min(quantity, i.stockQuantity) } : i))
      .filter((i) => i.quantity > 0);
    return this.saveGuest(items);
  }

  removeItem(itemId: number): Observable<Cart> {
    if (this.auth.isLoggedIn()) {
      return this.api.removeItem(itemId).pipe(tap((cart) => this.cart.set(cart)));
    }
    return this.saveGuest(readGuest().filter((i) => i.productId !== itemId));
  }

  // Après une déconnexion ou une commande : repart sur le panier local (vide)
  clearLocal() {
    this.cart.set(toCart(readGuest()));
  }

  private saveGuest(items: GuestItem[]): Observable<Cart> {
    writeGuest(items);
    const cart = toCart(items);
    this.cart.set(cart);
    return of(cart);
  }
}
