import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateStockDto, UpdateProductStatusDto, UpdateOrderStatusDto } from './admin.dto';
import { OrderStatus } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Ajustez le chemin selon votre structure auth

@Controller('admin')
@UseGuards(JwtAuthGuard) // Sécurise l'ensemble des routes admin
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('products/stock')
  async updateStock(@Req() req: any, @Body() dto: UpdateStockDto) {
    // Récupération dynamique de l'ID de l'admin connecté
    const adminUserId = req.user?.id || req.user?.sub;
    return this.adminService.updateStock(adminUserId, dto);
  }

  @Patch('products/:id/status')
  async toggleProductStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.adminService.toggleProductStatus(id, dto);
  }

  @Get('products/:id')
  async getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getProductById(id);
  }

  @Get('stock/movements')
  async getStockMovements(@Query('productId') productId?: string) {
    const pId = productId ? Number.parseInt(productId, 10) : undefined;
    return this.adminService.getStockMovements(pId);
  }

  @Get('orders')
  async getAllOrders(@Query('status') status?: OrderStatus) {
    return this.adminService.getAllOrders(status);
  }

  @Get('orders/:id')
  async getAdminOrderDetails(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminOrderDetails(id);
  }

  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const adminUserId = req.user?.id || req.user?.sub;
    return this.adminService.updateOrderStatus(adminUserId, id, dto);
  }
}