import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ToNumber, invalid } from '../common/validation';

export const MAX_QUANTITY = 99;

const INVALID_PRODUCT = invalid('Produit', 'Product');
const INVALID_QUANTITY = invalid('Quantité', 'Quantity');

export class AddCartItemDto {
  @ApiProperty({ example: 2184, description: 'Identifiant du produit' })
  @ToNumber()
  @IsInt({ message: INVALID_PRODUCT })
  @Min(1, { message: INVALID_PRODUCT })
  productId!: number;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: MAX_QUANTITY,
    default: 1,
  })
  @IsOptional()
  @ToNumber()
  @IsInt({ message: INVALID_QUANTITY })
  @Min(1, { message: INVALID_QUANTITY })
  @Max(MAX_QUANTITY, { message: INVALID_QUANTITY })
  quantity?: number;
}

export class UpdateCartItemDto {
  @ApiProperty({
    example: 2,
    minimum: 0,
    maximum: MAX_QUANTITY,
    description: '0 retire l’article du panier',
  })
  @ToNumber()
  @IsInt({ message: INVALID_QUANTITY })
  @Min(0, { message: INVALID_QUANTITY })
  @Max(MAX_QUANTITY, { message: INVALID_QUANTITY })
  quantity!: number;
}
