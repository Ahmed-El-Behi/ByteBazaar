import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './models';

export interface AdminOrderItem {
  id: number;
  productName: string;
  productSku?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface AdminOrder {
  id: number;
  reference: string;
  createdAt: string;
  total: number;
  subtotal: number;
  shippingFee: number;
  paymentMethod?: string;
  paymentStatus: string;
  status: string;
  user?: { firstName: string; lastName: string; email: string };
  items: AdminOrderItem[];
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

@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private readonly http = inject(HttpClient);

  getAllOrders(status?: string): Observable<AdminOrder[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<AdminOrder[]>(`${API_URL}/admin/orders`, { params });
  }

  getAdminOrderDetails(id: number): Observable<AdminOrder> {
    return this.http.get<AdminOrder>(`${API_URL}/admin/orders/${id}`);
  }

  updateOrderStatus(
    id: number,
    dto: { status?: string; paymentStatus?: string }
  ): Observable<AdminOrder> {
    return this.http.patch<AdminOrder>(`${API_URL}/admin/orders/${id}/status`, dto);
  }

  getStockMovements(productId?: number): Observable<StockMovement[]> {
    let params = new HttpParams();
    if (productId) {
      params = params.set('productId', String(productId));
    }
    return this.http.get<StockMovement[]>(`${API_URL}/admin/stock/movements`, { params });
  }

  // Accepte à la fois la signature Objet DTO ou la signature multi-arguments pour rétrocompatibilité
  updateStock(
    productIdOrDto: number | { productId: number; quantityChange: number; reason?: string; note?: string },
    quantityChange?: number,
    reason?: string,
    note?: string
  ) {
    let body: { productId: number; quantityChange: number; reason?: string; note?: string };

    if (typeof productIdOrDto === 'object') {
      body = productIdOrDto;
    } else {
      body = {
        productId: productIdOrDto,
        quantityChange: quantityChange!,
        reason,
        note,
      };
    }

    return this.http.patch(`${API_URL}/admin/products/stock`, body);
  }

  toggleProductStatus(productId: number, isActive: boolean) {
    return this.http.patch(`${API_URL}/admin/products/${productId}/status`, { isActive });
  }
}