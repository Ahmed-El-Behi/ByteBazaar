import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

// Toutes les routes exigent un compte ADMIN (JwtAuthGuard identifie, RolesGuard autorise)
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly dashboardService: DashboardService,
  ) {}

  // ?days=7|30|90|365 (30 par défaut)
  @Get('dashboard')
  getDashboard(@Query('days') days?: string) {
    return this.dashboardService.getDashboard(days);
  }

  // Corps : { productId, quantityChange, reason?, note? }
  @Patch('products/stock')
  updateStock(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.adminService.updateStock(req.user!.id, body);
  }

  // Corps : { isActive: boolean }
  @Patch('products/:id/status')
  setProductStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.adminService.setProductStatus(id, body);
  }

  @Get('products/:id')
  getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getProductById(id);
  }

  @Get('stock/movements')
  getStockMovements(@Query('productId') productId?: string) {
    return this.adminService.getStockMovements(productId);
  }

  @Get('orders')
  getAllOrders(@Query('status') status?: string) {
    return this.adminService.getAllOrders(status);
  }

  @Get('orders/:id')
  getAdminOrderDetails(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminOrderDetails(id);
  }

  // Corps : { status?, paymentStatus? }
  @Patch('orders/:id/status')
  updateOrderStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.adminService.updateOrderStatus(req.user!.id, id, body);
  }
}
