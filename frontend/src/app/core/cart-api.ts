import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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

  clear() {
    return this.http.delete<Cart>(`${API_URL}/cart`);
  }

  getAddresses() {
    return this.http.get<Address[]>(`${API_URL}/orders/addresses`);
  }

  createAddress(data: Record<string, unknown>) {
    return this.http.post<Address>(`${API_URL}/orders/addresses`, data);
  }

  /** Renvoie la liste des adresses à jour */
  deleteAddress(id: number) {
    return this.http.delete<Address[]>(`${API_URL}/orders/addresses/${id}`);
  }

  /** Renvoie la liste des adresses à jour */
  setDefaultAddress(id: number) {
    return this.http.patch<Address[]>(`${API_URL}/orders/addresses/${id}/default`, {});
  }
}
