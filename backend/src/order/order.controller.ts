import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { OrderService } from './order.service';
import { AddressDto, CheckoutDto } from './order.dto';

@ApiTags('Commandes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({
    summary: 'Adresses de livraison du client',
    description: 'L’adresse par défaut en premier.',
  })
  @Get('addresses')
  getAddresses(@Req() req: AuthedRequest) {
    return this.orderService.getAddresses(req.user!.id);
  }

  @ApiOperation({ summary: 'Enregistrer une adresse' })
  @Post('addresses')
  createAddress(@Req() req: AuthedRequest, @Body() body: AddressDto) {
    return this.orderService.createAddress(req.user!.id, body);
  }

  @ApiOperation({ summary: 'Choisir l’adresse par défaut' })
  @Patch('addresses/:id/default')
  setDefaultAddress(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.setDefaultAddress(req.user!.id, id);
  }

  @ApiOperation({
    summary: 'Supprimer une adresse',
    description:
      'Si c’était l’adresse par défaut, la plus récente la remplace.',
  })
  @Delete('addresses/:id')
  deleteAddress(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.deleteAddress(req.user!.id, id);
  }

  @ApiOperation({
    summary: 'Passer la commande',
    description:
      'Transforme le panier en commande : vérifie et réserve le stock, envoie l’e-mail de confirmation.',
  })
  @Post('checkout')
  checkout(@Req() req: AuthedRequest, @Body() body: CheckoutDto) {
    return this.orderService.checkout(req.user!.id, body);
  }

  // GET /orders et GET /orders/my-orders
  @ApiOperation({
    summary: 'Commandes du client',
    description:
      'Les plus récentes en premier, avec articles et historique des statuts.',
  })
  @Get(['', 'my-orders'])
  getMyOrders(@Req() req: AuthedRequest) {
    return this.orderService.getMyOrders(req.user!.id);
  }

  @ApiOperation({
    summary: 'Annuler une commande',
    description:
      'Possible tant qu’elle est en attente ou confirmée : remise en stock et remboursement si payée.',
  })
  @Post(':id/cancel')
  @HttpCode(200)
  cancelOrder(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.cancelOrder(req.user!.id, id);
  }

  @ApiOperation({
    summary: 'Détail d’une commande',
    description: 'Articles, adresse, paiement et historique daté des statuts.',
  })
  @Get(':id')
  getOrderDetails(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.getOrderDetails(req.user!.id, id);
  }
}
