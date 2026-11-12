import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('addresses')
  getAddresses(@Req() req: AuthedRequest) {
    return this.orderService.getAddresses(req.user!.id);
  }

  @Post('addresses')
  createAddress(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.orderService.createAddress(req.user!.id, body);
  }

  // Corps : { addressId } ou { newAddress }, + paymentMethod
  @Post('checkout')
  checkout(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.orderService.checkout(req.user!.id, body);
  }

  // GET /orders et GET /orders/my-orders
  @Get(['', 'my-orders'])
  getMyOrders(@Req() req: AuthedRequest) {
    return this.orderService.getMyOrders(req.user!.id);
  }

  @Get(':id')
  getOrderDetails(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.getOrderDetails(req.user!.id, id);
  }
}
