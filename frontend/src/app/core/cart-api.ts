import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { API_URL } from './models';

export interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: {
    name: string;
    slug: string;
    stockQuantity: number;
    isAvailable: boolean;
    image: { url: string; altText: string | null } | null;
  };
}

export interface Cart {
  id: number;
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface Address {
  id: number;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  governorate: string;
  postalCode: string;
  isDefault: boolean;
}

export interface Order {
  id: number;
  reference: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  createdAt: string;
  items: {
    id: number;
    productId?: number;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    imageUrl?: string;
    productImage?: string;
    product?: {
      image?: { url: string; altText: string | null } | null;
    };
  }[];
}

export const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Paiement à la livraison',
  CARD: 'Carte bancaire',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Virement bancaire',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

const DELETED_ADDR_KEY = 'bytebazaar_deleted_addresses';
const DEFAULT_ADDR_KEY = 'bytebazaar_default_address_id';

@Injectable({ providedIn: 'root' })
export class CartApi {
  private http = inject(HttpClient);

  getCart() {
    return this.http.get<Cart>(`${API_URL}/cart`);
  }

  addItem(productId: number, quantity = 1) {
    return this.http.post<Cart>(`${API_URL}/cart/items`, { productId, quantity });
  }

  updateItem(itemId: number, quantity: number) {
    return this.http.patch<Cart>(`${API_URL}/cart/items/${itemId}`, { quantity });
  }

  removeItem(itemId: number) {
    return this.http.delete<Cart>(`${API_URL}/cart/items/${itemId}`);
  }

  getAddresses(): Observable<Address[]> {
    return this.http.get<Address[]>(`${API_URL}/orders/addresses`).pipe(
      map((addresses) => {
        const deletedIds = this.getDeletedAddressIds();
        const savedDefaultId = this.getDefaultAddressId();

        let filtered = (addresses || []).filter((addr) => !deletedIds.includes(addr.id));

        if (savedDefaultId !== null && filtered.some((a) => a.id === savedDefaultId)) {
          filtered = filtered.map((a) => ({
            ...a,
            isDefault: a.id === savedDefaultId,
          }));
        }

        return filtered;
      }),
      catchError(() => of([]))
    );
  }

  createAddress(data: Record<string, unknown>): Observable<Address> {
    return this.http.post<Address>(`${API_URL}/orders/addresses`, data);
  }

  deleteAddress(id: number): Observable<any> {
    this.markAddressAsDeleted(id);
    return this.http.delete<void>(`${API_URL}/orders/addresses/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  setDefaultAddress(id: number): Observable<any> {
    localStorage.setItem(DEFAULT_ADDR_KEY, id.toString());
    return this.http.patch<void>(`${API_URL}/orders/addresses/${id}/default`, {}).pipe(
      catchError(() => of(null))
    );
  }

  checkout(data: { addressId?: number; newAddress?: Record<string, unknown>; paymentMethod?: string }) {
    return this.http.post<Order>(`${API_URL}/orders/checkout`, data);
  }

  getMyOrders() {
    return this.http.get<Order[]>(`${API_URL}/orders`);
  }

  getOrder(id: number) {
    return this.http.get<Order>(`${API_URL}/orders/${id}`);
  }

  private getDeletedAddressIds(): number[] {
    try {
      const stored = localStorage.getItem(DELETED_ADDR_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private markAddressAsDeleted(id: number) {
    const deletedIds = this.getDeletedAddressIds();
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      localStorage.setItem(DELETED_ADDR_KEY, JSON.stringify(deletedIds));
    }
  }

  private getDefaultAddressId(): number | null {
    const val = localStorage.getItem(DEFAULT_ADDR_KEY);
    return val ? Number(val) : null;
  }
}