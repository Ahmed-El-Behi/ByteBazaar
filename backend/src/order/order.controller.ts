import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { CheckoutDto, CreateAddressDto } from './order.dto';
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
  createAddress(@Req() req: AuthedRequest, @Body() dto: CreateAddressDto) {
    return this.orderService.createAddress(req.user!.id, dto);
  }

  @Post('checkout')
  checkout(@Req() req: AuthedRequest, @Body() dto: CheckoutDto) {
    return this.orderService.checkout(req.user!.id, dto);
  }

  @Get()
  getMyOrders(@Req() req: AuthedRequest) {
    return this.orderService.getMyOrders(req.user!.id);
  }

  @Get(':id')
  getOrderDetails(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.getOrderDetails(req.user!.id, id);
  }
}