import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { asRecord } from '../common/input';
import { CartService } from './cart.service';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: AuthedRequest) {
    return this.cartService.getCart(req.user!.id);
  }

  // Corps : { productId: number, quantity?: number }
  @Post('items')
  addItem(@Req() req: AuthedRequest, @Body() body: unknown) {
    const b = asRecord(body);
    return this.cartService.addItem(req.user!.id, b.productId, b.quantity ?? 1);
  }

  // Corps : { quantity: number } (0 supprime la ligne)
  @Patch('items/:id')
  updateItem(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() body: unknown,
  ) {
    return this.cartService.updateItem(
      req.user!.id,
      itemId,
      asRecord(body).quantity,
    );
  }

  @Delete('items/:id')
  removeItem(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) itemId: number,
  ) {
    return this.cartService.removeItem(req.user!.id, itemId);
  }

  @Delete()
  clearCart(@Req() req: AuthedRequest) {
    return this.cartService.clearCart(req.user!.id);
  }
}
