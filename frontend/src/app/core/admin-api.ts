import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './models';
import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from './orders-api';

export interface AdminOrder extends Order {
  user?: { id: number; firstName: string; lastName: string; email: string; phone: string | null };
}

export interface StockMovement {
  id: number;
  productId: number;
  quantityChange: number;
  historicalStock?: number;
  reason: string;
  note?: string;
  createdAt: string;
  product?: { id: number; name: string; sku: string; stockQuantity: number };
  user?: { firstName: string; lastName: string; email: string };
}

export type DashboardPeriod = 7 | 30 | 90 | 365;

export interface Dashboard {
  period: { days: DashboardPeriod; from: string; granularity: 'day' | 'month' };
  kpis: {
    revenue: number;
    revenueChange: number | null;
    orders: number;
    ordersChange: number | null;
    averageBasket: number;
    averageBasketChange: number | null;
    itemsSold: number;
    newCustomers: number;
    newCustomersChange: number | null;
    toProcess: number;
    awaitingPayment: number;
    lowStock: number;
    outOfStock: number;
  };
  timeline: { bucket: string; revenue: number; orders: number }[];
  statuses: { status: OrderStatus; count: number }[];
  payments: { method: PaymentMethod; orders: number; revenue: number }[];
  categories: { slug: string; nameFr: string; nameEn: string; quantity: number; revenue: number }[];
  topProducts: {
    id: number;
    name: string;
    slug: string;
    image: string | null;
    quantity: number;
    revenue: number;
  }[];
  lowStock: {
    id: number;
    name: string;
    sku: string;
    slug: string;
    stockQuantity: number;
    image: string | null;
  }[];
  recentOrders: {
    id: number;
    reference: string;
    createdAt: string;
    total: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    user: { firstName: string; lastName: string } | null;
  }[];
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  getDashboard(days: DashboardPeriod): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${API_URL}/admin/dashboard`, {
      params: { days: String(days) },
    });
  }

  getAllOrders(status?: string): Observable<AdminOrder[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<AdminOrder[]>(`${API_URL}/admin/orders`, { params });
  }

  getAdminOrderDetails(id: number): Observable<AdminOrder> {
    return this.http.get<AdminOrder>(`${API_URL}/admin/orders/${id}`);
  }

  updateOrderStatus(
    id: number,
    dto: { status?: OrderStatus; paymentStatus?: PaymentStatus },
  ): Observable<AdminOrder> {
    return this.http.patch<AdminOrder>(`${API_URL}/admin/orders/${id}/status`, dto);
  }

  getStockMovements(productId?: number): Observable<StockMovement[]> {
    let params = new HttpParams();
    if (productId) params = params.set('productId', String(productId));
    return this.http.get<StockMovement[]>(`${API_URL}/admin/stock/movements`, { params });
  }

  updateStock(body: { productId: number; quantityChange: number; reason?: string; note?: string }) {
    return this.http.patch(`${API_URL}/admin/products/stock`, body);
  }

  toggleProductStatus(productId: number, isActive: boolean) {
    return this.http.patch(`${API_URL}/admin/products/${productId}/status`, { isActive });
  }
}
