export class CreateAddressDto {
  label!: string;
  recipientName!: string;
  phone!: string;
  street!: string;
  city!: string;
  governorate!: string;
  postalCode!: string;
  isDefault?: boolean;
}

export class CheckoutDto {
  addressId?: number;
  newAddress?: CreateAddressDto;
  paymentMethod?: 'CASH_ON_DELIVERY' | 'BANK_TRANSFER' | 'CARD' | 'PAYPAL';
}