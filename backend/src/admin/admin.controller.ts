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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { ORDER_STATUSES } from '../order/order-status';
import { AdminService } from './admin.service';
import { ADMIN_ORDER_FILTERS } from './order-filters';
import { DashboardService } from './dashboard.service';
import { OrderStatusDto, ProductStatusDto, UpdateStockDto } from './admin.dto';

// Toutes les routes exigent un compte ADMIN (JwtAuthGuard identifie, RolesGuard autorise)
@ApiTags('Administration')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly dashboardService: DashboardService,
  ) {}

  @ApiOperation({
    summary: 'Tableau de bord',
    description:
      'Indicateurs (avec évolution par rapport à la période précédente), chiffre d’affaires, statuts, meilleures ventes, stock faible.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    enum: ['7', '30', '90', '365'],
    description: 'Période (30 par défaut)',
  })
  @Get('dashboard')
  getDashboard(@Query('days') days?: string) {
    return this.dashboardService.getDashboard(days);
  }

  @ApiOperation({
    summary: 'Ajuster le stock d’un produit',
    description:
      'Crée un mouvement de stock daté (réassort, retour, ajustement).',
  })
  @Patch('products/stock')
  updateStock(@Req() req: AuthedRequest, @Body() body: UpdateStockDto) {
    return this.adminService.updateStock(req.user!.id, body);
  }

  @ApiOperation({ summary: 'Mettre en vente ou retirer un produit' })
  @Patch('products/:id/status')
  setProductStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ProductStatusDto,
  ) {
    return this.adminService.setProductStatus(id, body);
  }

  @ApiOperation({ summary: 'Fiche produit (vue administrateur)' })
  @Get('products/:id')
  getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getProductById(id);
  }

  @ApiOperation({ summary: 'Historique des mouvements de stock' })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Limiter à un produit',
  })
  @Get('stock/movements')
  getStockMovements(@Query('productId') productId?: string) {
    return this.adminService.getStockMovements(productId);
  }

  @ApiOperation({
    summary: 'Commandes, page par page',
    description:
      'Lignes légères (le détail se charge avec GET /admin/orders/:id), filtre et recherche appliqués par la base, et nombre de commandes de chaque filtre.',
  })
  @ApiQuery({ name: 'filter', required: false, enum: ADMIN_ORDER_FILTERS })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Référence, client, e-mail ou téléphone (chaque mot doit correspondre)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 25,
    description: '1 à 100',
  })
  @ApiQuery({ name: 'status', required: false, enum: ORDER_STATUSES })
  @Get('orders')
  listOrders(
    @Query('filter') filter?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listOrders({ filter, q, page, limit, status });
  }

  @ApiOperation({
    summary: 'Détail d’une commande (vue administrateur)',
    description:
      'Avec le client et l’historique des statuts (qui a fait quoi, quand).',
  })
  @Get('orders/:id')
  getAdminOrderDetails(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminOrderDetails(id);
  }

  @ApiOperation({
    summary: 'Changer le statut d’une commande ou de son paiement',
    description:
      'Les statuts ne font qu’avancer ; une annulation remet en stock et rembourse. Le client reçoit un e-mail.',
  })
  @Patch('orders/:id/status')
  updateOrderStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(req.user!.id, id, body);
  }
}
