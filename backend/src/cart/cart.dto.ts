export class AddToCartDto {
  productId!: number;
  quantity!: number;
}

export class UpdateCartItemDto {
  quantity!: number;
}