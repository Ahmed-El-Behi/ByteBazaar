import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  StockReason,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { asRecord, badRequest, int, oneOf, text } from '../common/input';

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = Object.values(PaymentStatus);
const STOCK_REASONS = Object.values(StockReason);

// Progression d'une commande : on avance, on ne recule pas. CANCELLED et DELIVERED sont définitifs.
// (même règle que l'écran admin-orders côté frontend)
const STATUS_RANK: Record<OrderStatus, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  CANCELLED: 99,
};
const FINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

const ORDER_INCLUDE = {
  items: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
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
      lineTotal:
        Math.round(Number(item.unitPrice) * item.quantity * 1000) / 1000,
    })),
  };
}

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return;
  if (FINAL_STATUSES.includes(from)) {
    throw new BadRequestException(
      `Une commande ${STATUS_LABELS[from].toLowerCase()} ne peut plus changer de statut`,
    );
  }
  if (to !== 'CANCELLED' && STATUS_RANK[to] < STATUS_RANK[from]) {
    throw new BadRequestException(
      `Impossible de repasser de « ${STATUS_LABELS[from]} » à « ${STATUS_LABELS[to]} »`,
    );
  }
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // --- PRODUITS ET STOCK ---

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        brand: { select: { name: true } },
      },
    });
    if (!product) throw new NotFoundException(`Produit #${id} introuvable`);
    return { ...product, price: Number(product.price) };
  }

  async updateStock(adminUserId: number, body: unknown) {
    const b = asRecord(body);
    const productId = int(b.productId, 'ID produit', { min: 1 });
    const quantityChange = int(b.quantityChange, 'Variation de stock', {
      min: -100_000,
      max: 100_000,
    });
    if (quantityChange === 0)
      throw badRequest('La variation de stock doit être différente de 0');
    const reason = oneOf(b.reason, STOCK_REASONS, 'Motif') ?? 'ADJUSTMENT';
    const note =
      text(b.note) || `Ajustement manuel admin (User #${adminUserId})`;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stockQuantity: true },
      });
      if (!product)
        throw new NotFoundException(
          `Produit #${productId} introuvable dans le catalogue`,
        );

      // Mise à jour conditionnelle : le stock ne peut pas devenir négatif, même en concurrence
      const changed = await tx.product.updateMany({
        where: { id: productId, stockQuantity: { gte: -quantityChange } },
        data: { stockQuantity: { increment: quantityChange } },
      });
      if (changed.count === 0) {
        throw new BadRequestException(
          `Stock insuffisant. Stock actuel : ${product.stockQuantity}`,
        );
      }

      await tx.stockMovement.create({
        data: {
          productId,
          performedById: adminUserId,
          quantityChange,
          reason,
          note,
        },
      });

      return tx.product.findUniqueOrThrow({ where: { id: productId } });
    });
  }

  async setProductStatus(productId: number, body: unknown) {
    const isActive = asRecord(body).isActive;
    if (typeof isActive !== 'boolean')
      throw badRequest('isActive doit être un booléen');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produit non trouvé');

    return this.prisma.product.update({
      where: { id: productId },
      data: { isActive },
    });
  }

  async getStockMovements(rawProductId?: string) {
    const productId = rawProductId
      ? int(rawProductId, 'ID produit', { min: 1 })
      : undefined;
    const movements = await this.prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        product: {
          select: { id: true, name: true, sku: true, stockQuantity: true },
        },
        performedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    // Stock après chaque mouvement, reconstitué à rebours depuis le stock actuel
    const runningStock = new Map<number, number>();
    return movements.map(({ performedBy, ...movement }) => {
      const stockAfter =
        runningStock.get(movement.productId) ?? movement.product.stockQuantity;
      runningStock.set(
        movement.productId,
        stockAfter - movement.quantityChange,
      );
      return { ...movement, user: performedBy, historicalStock: stockAfter };
    });
  }

  // --- COMMANDES ---

  async getAllOrders(rawStatus?: string) {
    const status = oneOf(rawStatus, ORDER_STATUSES, 'Statut');
    const orders = await this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return orders.map(formatOrder);
  }

  async getAdminOrderDetails(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    return formatOrder(order);
  }

  async updateOrderStatus(adminUserId: number, id: number, body: unknown) {
    const b = asRecord(body);
    const status = oneOf(b.status, ORDER_STATUSES, 'Statut de commande');
    const paymentStatus = oneOf(
      b.paymentStatus,
      PAYMENT_STATUSES,
      'Statut de paiement',
    );
    if (!status && !paymentStatus)
      throw badRequest('Aucune modification demandée');

    const { order, statusChanged } = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!current) throw new NotFoundException('Commande non trouvée');

        const data: Prisma.OrderUpdateInput = {};
        const now = new Date();
        const statusChanged = !!status && status !== current.status;

        if (status && statusChanged) {
          assertTransition(current.status, status);
          data.status = status;

          if (status === 'SHIPPED' && !current.shippedAt) data.shippedAt = now;
          if (status === 'DELIVERED') {
            if (!current.shippedAt) data.shippedAt = now;
            data.deliveredAt = now;
            data.paymentStatus = 'PAID';
            if (!current.paidAt) data.paidAt = now;
          }

          // Annulation : remise en stock (une seule fois, CANCELLED étant définitif)
          if (status === 'CANCELLED') {
            for (const item of current.items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stockQuantity: { increment: item.quantity } },
              });
            }
            await tx.stockMovement.createMany({
              data: current.items.map((item) => ({
                productId: item.productId,
                performedById: adminUserId,
                quantityChange: item.quantity,
                reason: 'RETURN' as const,
                note: `Annulation commande ${current.reference}`,
              })),
            });
          }
        }

        if (paymentStatus) {
          data.paymentStatus = paymentStatus;
          if (paymentStatus === 'PAID' && !current.paidAt) data.paidAt = now;
        }

        const order = await tx.order.update({
          where: { id },
          data,
          include: ORDER_INCLUDE,
        });
        return { order, statusChanged };
      },
    );

    // Notification client en arrière-plan (MailService journalise les échecs)
    if (statusChanged && order.user?.email) {
      void this.mailService.sendOrderStatusNotification(
        order.user.email,
        order.user.firstName,
        order.reference,
        order.status,
      );
    }

    return formatOrder(order);
  }
}
