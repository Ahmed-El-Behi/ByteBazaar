import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './models';

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface CustomerOrder {
  id: number;
  reference: string;
  status: OrderStatus;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  items: OrderItem[];
}

@Injectable({
  providedIn: 'root',
})
export class OrdersApiService {
  private readonly http = inject(HttpClient);

  getMyOrders(): Observable<CustomerOrder[]> {
    return this.http.get<CustomerOrder[]>(`${API_URL}/orders/my-orders`);
  }

  getOrderDetails(id: number): Observable<CustomerOrder> {
    return this.http.get<CustomerOrder>(`${API_URL}/orders/${id}`);
  }
}
