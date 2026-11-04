import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { AddToCartDto, UpdateCartItemDto } from './cart.dto';
import { CartService } from './cart.service';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: AuthedRequest) {
    return this.cartService.getCart(req.user!.id);
  }

  @Post('items')
  addItem(@Req() req: AuthedRequest, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(req.user!.id, dto.productId, dto.quantity);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user!.id, itemId, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) itemId: number) {
    return this.cartService.removeItem(req.user!.id, itemId);
  }

  @Delete()
  clearCart(@Req() req: AuthedRequest) {
    return this.cartService.clearCart(req.user!.id);
  }
}