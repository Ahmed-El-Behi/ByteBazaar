import { OrderStatus, PaymentStatus, StockReason } from '../generated/prisma/client';

export class UpdateStockDto {
  productId!: number;
  quantityChange!: number; // Positif (RESTOCK, RETURN) ou Négatif (SALE, ADJUSTMENT)
  reason!: StockReason;    // RESTOCK, SALE, RETURN, ADJUSTMENT
  note?: string;
}

export class UpdateProductStatusDto {
  isActive!: boolean;
}

export class UpdateOrderStatusDto {
  status?: OrderStatus;         // PENDING, CONFIRMED, PREPARING, SHIPPED, DELIVERED, CANCELLED
  paymentStatus?: PaymentStatus; // PENDING, PAID, FAILED, REFUNDED
}