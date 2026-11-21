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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './cart.dto';

@ApiTags('Panier')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Panier de l’utilisateur connecté',
    description: 'Articles, prix unitaires et total.',
  })
  @Get()
  getCart(@Req() req: AuthedRequest) {
    return this.cartService.getCart(req.user!.id);
  }

  @ApiOperation({
    summary: 'Ajouter un produit',
    description:
      'Ajoute la quantité à la ligne existante ; refusé au-delà du stock.',
  })
  @Post('items')
  addItem(@Req() req: AuthedRequest, @Body() body: AddCartItemDto) {
    return this.cartService.addItem(
      req.user!.id,
      body.productId,
      body.quantity ?? 1,
    );
  }

  @ApiOperation({
    summary: 'Changer la quantité d’un article',
    description: '0 retire l’article.',
  })
  @Patch('items/:id')
  updateItem(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user!.id, itemId, body.quantity);
  }

  @ApiOperation({ summary: 'Retirer un article' })
  @Delete('items/:id')
  removeItem(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) itemId: number,
  ) {
    return this.cartService.removeItem(req.user!.id, itemId);
  }

  @ApiOperation({ summary: 'Vider le panier' })
  @Delete()
  clearCart(@Req() req: AuthedRequest) {
    return this.cartService.clearCart(req.user!.id);
  }
}
