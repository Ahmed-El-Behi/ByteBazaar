import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrderStatusDto, UpdateProductStatusDto, UpdateStockDto } from './admin.dto';

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: { items: true; user: { select: { id: true; email: true; firstName: true; lastName: true } } };
}>;

function formatOrder(order: OrderWithDetails) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Math.round(Number(item.unitPrice) * item.quantity * 1000) / 1000,
    })),
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // --- GESTION DU STOCK ET PRODUITS ---

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        brand: { select: { name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit #${id} introuvable`);
    }

    return {
      ...product,
      price: Number(product.price),
    };
  }

  async updateStock(adminUserId: number, dto: UpdateStockDto) {
    const productId = Number.parseInt(String(dto.productId), 10);
    const quantityChange = Number.parseInt(String(dto.quantityChange), 10);

    if (Number.isNaN(productId)) {
      throw new BadRequestException('ID produit invalide');
    }

    if (Number.isNaN(quantityChange) || quantityChange === 0) {
      throw new BadRequestException('La variation de stock (quantityChange) doit être un entier différent de 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException(`Produit #${productId} introuvable dans le catalogue`);
      }

      const newQuantity = product.stockQuantity + quantityChange;
      if (newQuantity < 0) {
        throw new BadRequestException(`Stock insuffisant. Stock actuel : ${product.stockQuantity}`);
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: newQuantity },
      });

      // Stocke l'ID dynamique de l'administrateur connecté
      await tx.stockMovement.create({
        data: {
          productId,
          performedById: adminUserId,
          quantityChange,
          reason: dto.reason || 'ADJUSTMENT',
          note: dto.note || `Ajustement manuel admin (User #${adminUserId})`,
        },
      });

      return updatedProduct;
    });
  }

  async toggleProductStatus(productId: number, dto: UpdateProductStatusDto) {
    const id = Number.parseInt(String(productId), 10);
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit non trouvé');

    return this.prisma.product.update({
      where: { id },
      data: { isActive: dto.isActive },
    });
  }

  async getStockMovements(productId?: number) {
    const pId = productId ? Number.parseInt(String(productId), 10) : undefined;
    const movements = await this.prisma.stockMovement.findMany({
      where: pId && !Number.isNaN(pId) ? { productId: pId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        product: { select: { id: true, name: true, sku: true, stockQuantity: true } },
        performedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const productCurrentStocks = new Map<number, number>();

    return movements.map((m) => {
      const prodId = m.productId;

      if (!productCurrentStocks.has(prodId)) {
        productCurrentStocks.set(prodId, m.product?.stockQuantity ?? 0);
      }

      const currentStockAtThisStep = productCurrentStocks.get(prodId)!;
      productCurrentStocks.set(prodId, currentStockAtThisStep - m.quantityChange);

      const { performedBy, ...rest } = m;
      return {
        ...rest,
        user: performedBy,
        historicalStock: currentStockAtThisStep,
      };
    });
  }

  // --- GESTION DES COMMANDES ---

  async getAllOrders(status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return orders.map(formatOrder);
  }

  async getAdminOrderDetails(orderId: number) {
    const id = Number.parseInt(String(orderId), 10);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (!order) throw new NotFoundException('Commande non trouvée');
    return formatOrder(order);
  }

  async updateOrderStatus(adminUserId: number, orderId: number, dto: UpdateOrderStatusDto) {
    const id = Number.parseInt(String(orderId), 10);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) throw new NotFoundException('Commande non trouvée');

      const dataToUpdate: Prisma.OrderUpdateInput = {};

      if (dto.status) {
        dataToUpdate.status = dto.status;

        if (dto.status === 'SHIPPED' && !order.shippedAt) dataToUpdate.shippedAt = new Date();
        if (dto.status === 'DELIVERED') {
          if (!order.deliveredAt) dataToUpdate.deliveredAt = new Date();
          dataToUpdate.paymentStatus = 'PAID';
          if (!order.paidAt) dataToUpdate.paidAt = new Date();
        }

        if (dto.status === 'CANCELLED' && order.status !== 'CANCELLED') {
          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                performedById: adminUserId,
                quantityChange: item.quantity,
                reason: 'RETURN',
                note: `Annulation commande ${order.reference}`,
              },
            });
          }
        }
      }

      if (dto.paymentStatus) {
        dataToUpdate.paymentStatus = dto.paymentStatus;
        if (dto.paymentStatus === 'PAID' && !order.paidAt) {
          dataToUpdate.paidAt = new Date();
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: dataToUpdate,
        include: {
          items: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      return formatOrder(updated);
    });
  }
}