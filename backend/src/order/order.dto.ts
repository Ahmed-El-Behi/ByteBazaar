import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IsCompleteAddress,
  Optional,
  ToNumber,
  Trim,
  invalid,
} from '../common/validation';

export const PAYMENT_METHODS = [
  'CASH_ON_DELIVERY',
  'CARD',
  'PAYPAL',
  'BANK_TRANSFER',
] as const;

export class AddressDto {
  @ApiPropertyOptional({ example: 'Maison', default: 'Maison' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Libellé', 'Label') })
  label?: string;

  // Contrôle global de l'adresse : un seul message listant les champs manquants
  @ApiProperty({ example: 'Mariem Trabelsi' })
  @Trim()
  @IsCompleteAddress()
  recipientName!: string;

  @ApiProperty({ example: '98 123 456' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Téléphone', 'Phone') })
  phone!: string;

  @ApiProperty({ example: '12 rue de Marseille' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Rue', 'Street') })
  street!: string;

  @ApiProperty({ example: 'Tunis' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Ville', 'City') })
  city!: string;

  @ApiProperty({ example: 'Tunis' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Gouvernorat', 'Governorate') })
  governorate!: string;

  @ApiProperty({ example: '1000' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Code postal', 'Postal code') })
  postalCode!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Devient l’adresse par défaut',
  })
  @IsOptional()
  @IsBoolean({ message: invalid('Adresse par défaut', 'Default address') })
  isDefault?: boolean;
}

/** Adresse enregistrée (`addressId`) ou nouvelle adresse (`newAddress`), et mode de paiement. */
export class CheckoutDto {
  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'CASH_ON_DELIVERY' })
  @Optional()
  @IsIn(PAYMENT_METHODS, {
    message: invalid('Mode de paiement', 'Payment method'),
  })
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({
    example: 12,
    description: 'Adresse enregistrée du client',
  })
  @IsOptional()
  @ToNumber()
  @IsInt({ message: invalid('Adresse', 'Address') })
  @Min(1, { message: invalid('Adresse', 'Address') })
  addressId?: number;

  @ApiPropertyOptional({
    type: AddressDto,
    description: 'Utilisée si aucune adresse enregistrée n’est choisie',
  })
  @ValidateIf(
    (dto: CheckoutDto) =>
      (dto.addressId === undefined || dto.addressId === null) &&
      !!dto.newAddress,
  )
  @ValidateNested()
  @Type(() => AddressDto)
  newAddress?: AddressDto;
}
