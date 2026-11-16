import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from './models';

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'CASH_ON_DELIVERY' | 'CARD' | 'PAYPAL' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: { url: string; altText: string | null } | null;
}

export interface OrderEvent {
  status: OrderStatus;
  createdAt: string;
  performedBy?: { firstName: string; lastName: string } | null;
}

export interface Order {
  id: number;
  reference: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canCancel?: boolean;
  items: OrderItem[];
  events: OrderEvent[];
}

/** Étapes normales d'une commande, dans l'ordre (frise de suivi) */
export const ORDER_STEPS: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
];

// Libellés en français, traduits à l'affichage
// i18n
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Reçue',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export const STATUS_HINTS: Record<OrderStatus, string> = {
  PENDING: 'Votre commande est enregistrée et sera validée sous peu.',
  CONFIRMED: 'Votre commande est validée et sera bientôt préparée.',
  PREPARING: 'Vos articles sont en cours de préparation.',
  SHIPPED: 'Votre colis est en route : livraison sous 24 à 72 h.',
  DELIVERED: 'Votre commande a été livrée.',
  CANCELLED: 'Cette commande a été annulée.',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH_ON_DELIVERY: 'Paiement à la livraison',
  CARD: 'Carte bancaire',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Virement bancaire',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'En attente de paiement',
  PAID: 'Payée',
  FAILED: 'Paiement refusé',
  REFUNDED: 'Remboursée',
};
// /i18n

/** Teinte associée à un statut (classe CSS « tone-… ») */
export function statusTone(status: OrderStatus): string {
  return {
    PENDING: 'warn',
    CONFIRMED: 'info',
    PREPARING: 'info',
    SHIPPED: 'violet',
    DELIVERED: 'green',
    CANCELLED: 'red',
  }[status];
}

export function paymentTone(status: PaymentStatus): string {
  return { PENDING: 'warn', PAID: 'green', FAILED: 'red', REFUNDED: 'muted' }[status];
}

export interface CheckoutInput {
  addressId?: number;
  newAddress?: Record<string, unknown>;
  paymentMethod: PaymentMethod;
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  checkout(data: CheckoutInput) {
    return this.http.post<Order>(`${API_URL}/orders/checkout`, data);
  }

  getMyOrders() {
    return this.http.get<Order[]>(`${API_URL}/orders`);
  }

  getOrder(id: number) {
    return this.http.get<Order>(`${API_URL}/orders/${id}`);
  }

  cancel(id: number) {
    return this.http.post<Order>(`${API_URL}/orders/${id}/cancel`, {});
  }
}
