import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  NotEquals,
} from 'class-validator';
import { PaymentStatus, StockReason } from '../generated/prisma/client';
import { ORDER_STATUSES } from '../order/order-status';
import { Optional, ToNumber, Trim, invalid, msg } from '../common/validation';

const STOCK_REASONS = Object.values(StockReason);
const PAYMENT_STATUSES = Object.values(PaymentStatus);
const INVALID_CHANGE = invalid('Variation de stock', 'Stock change');

export class UpdateStockDto {
  @ApiProperty({ example: 2184 })
  @ToNumber()
  @IsInt({ message: invalid('ID produit', 'Product ID') })
  @Min(1, { message: invalid('ID produit', 'Product ID') })
  productId!: number;

  @ApiProperty({
    example: 10,
    description: 'Positif pour un réassort, négatif pour une sortie (jamais 0)',
  })
  @ToNumber()
  @IsInt({ message: INVALID_CHANGE })
  @Min(-100_000, { message: INVALID_CHANGE })
  @Max(100_000, { message: INVALID_CHANGE })
  @NotEquals(0, {
    message: msg(
      'La variation de stock doit être différente de 0',
      'The stock change must be different from 0',
    ),
  })
  quantityChange!: number;

  @ApiPropertyOptional({ enum: STOCK_REASONS, default: 'ADJUSTMENT' })
  @Optional()
  @IsIn(STOCK_REASONS, { message: invalid('Motif', 'Reason') })
  reason?: StockReason;

  @ApiPropertyOptional({ example: 'Réception fournisseur' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Note', 'Note') })
  note?: string;
}

export class ProductStatusDto {
  @ApiProperty({
    example: false,
    description: 'false retire le produit de la vente',
  })
  @IsBoolean({
    message: msg('isActive doit être un booléen', 'isActive must be a boolean'),
  })
  isActive!: boolean;
}

/** Au moins un des deux champs ; les transitions de statut sont vérifiées par le service. */
export class OrderStatusDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @Optional()
  @IsIn(ORDER_STATUSES, {
    message: invalid('Statut de commande', 'Order status'),
  })
  status?: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @Optional()
  @IsIn(PAYMENT_STATUSES, {
    message: invalid('Statut de paiement', 'Payment status'),
  })
  paymentStatus?: PaymentStatus;
}
