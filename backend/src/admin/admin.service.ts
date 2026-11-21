import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, StockReason } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { asRecord, badRequest, int, oneOf, text } from '../common/input';
import { tr } from '../common/i18n';
import { cancelOrderTx } from '../order/order-cancel';
import { ORDER_STATUSES, assertTransition } from '../order/order-status';
import {
  ADMIN_ORDER_FILTERS,
  filterCounts,
  filterWhere,
  pendingTransferWhere,
  searchWhere,
} from './order-filters';

const PAYMENT_STATUSES = Object.values(PaymentStatus);
const STOCK_REASONS = Object.values(StockReason);

const ORDER_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: { product: { select: { sku: true, slug: true } } },
  },
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  events: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      status: true,
      createdAt: true,
      performedBy: { select: { firstName: true, lastName: true } },
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
    items: order.items.map(({ product, ...item }) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal:
        Math.round(Number(item.unitPrice) * item.quantity * 1000) / 1000,
      productSku: product.sku,
      productSlug: product.slug,
    })),
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // Produits et stock

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        brand: { select: { name: true } },
      },
    });
    if (!product)
      throw new NotFoundException(
        tr(`Produit #${id} introuvable`, `Product #${id} not found`),
      );
    return { ...product, price: Number(product.price) };
  }

  async updateStock(adminUserId: number, body: unknown) {
    const b = asRecord(body);
    const productId = int(b.productId, tr('ID produit', 'Product ID'), {
      min: 1,
    });
    const quantityChange = int(
      b.quantityChange,
      tr('Variation de stock', 'Stock change'),
      {
        min: -100_000,
        max: 100_000,
      },
    );
    if (quantityChange === 0)
      throw badRequest(
        tr(
          'La variation de stock doit être différente de 0',
          'The stock change must be different from 0',
        ),
      );
    const reason =
      oneOf(b.reason, STOCK_REASONS, tr('Motif', 'Reason')) ?? 'ADJUSTMENT';
    const note =
      text(b.note) || `Ajustement manuel admin (User #${adminUserId})`;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stockQuantity: true },
      });
      if (!product)
        throw new NotFoundException(
          tr(
            `Produit #${productId} introuvable dans le catalogue`,
            `Product #${productId} not found in the catalogue`,
          ),
        );

      // Mise à jour conditionnelle : le stock ne peut pas devenir négatif, même en concurrence
      const changed = await tx.product.updateMany({
        where: { id: productId, stockQuantity: { gte: -quantityChange } },
        data: { stockQuantity: { increment: quantityChange } },
      });
      if (changed.count === 0) {
        throw new BadRequestException(
          tr(
            `Stock insuffisant. Stock actuel : ${product.stockQuantity}`,
            `Insufficient stock. Current stock: ${product.stockQuantity}`,
          ),
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
      throw badRequest(
        tr('isActive doit être un booléen', 'isActive must be a boolean'),
      );

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException(
        tr('Produit non trouvé', 'Product not found'),
      );

    return this.prisma.product.update({
      where: { id: productId },
      data: { isActive },
    });
  }

  async getStockMovements(rawProductId?: string) {
    const productId = rawProductId
      ? int(rawProductId, tr('ID produit', 'Product ID'), { min: 1 })
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

  // Commandes

  /**
   * Liste paginée pour la page « Commandes » : lignes légères (sans articles ni historique, chargés à
   * l'ouverture d'une commande), filtre et recherche appliqués par la base, compteurs de chaque filtre.
   */
  async listOrders(query: {
    filter?: string;
    q?: string;
    page?: string;
    limit?: string;
    status?: string;
  }) {
    const filter =
      oneOf(query.filter, ADMIN_ORDER_FILTERS, tr('Filtre', 'Filter')) ??
      'toutes';
    const status = oneOf(query.status, ORDER_STATUSES, tr('Statut', 'Status'));
    const page = query.page
      ? int(query.page, tr('Page', 'Page'), { min: 1, max: 100_000 })
      : 1;
    const limit = query.limit
      ? int(query.limit, tr('Nombre par page', 'Page size'), {
          min: 1,
          max: 100,
        })
      : 25;
    const where: Prisma.OrderWhereInput = {
      AND: [
        filterWhere(filter),
        ...(status ? [{ status }] : []),
        ...searchWhere(text(query.q)),
      ],
    };

    const [total, rows, byStatus, pendingTransfers] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          reference: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.count({ where: pendingTransferWhere() }),
    ]);

    return {
      data: rows.map((o) => ({ ...o, total: Number(o.total) })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      counts: filterCounts(
        byStatus.map((g) => ({ status: g.status, count: g._count._all })),
        pendingTransfers,
      ),
    };
  }

  async getAdminOrderDetails(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException(
        tr('Commande non trouvée', 'Order not found'),
      );
    return formatOrder(order);
  }

  async updateOrderStatus(adminUserId: number, id: number, body: unknown) {
    const b = asRecord(body);
    const status = oneOf(
      b.status,
      ORDER_STATUSES,
      tr('Statut de commande', 'Order status'),
    );
    const paymentStatus = oneOf(
      b.paymentStatus,
      PAYMENT_STATUSES,
      tr('Statut de paiement', 'Payment status'),
    );
    if (!status && !paymentStatus)
      throw badRequest(
        tr('Aucune modification demandée', 'No change requested'),
      );

    const { order, statusChanged } = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!current)
          throw new NotFoundException(
            tr('Commande non trouvée', 'Order not found'),
          );

        const statusChanged = !!status && status !== current.status;
        if (status && statusChanged) assertTransition(current.status, status);

        // Annulation : remise en stock et remboursement éventuel (voir cancelOrderTx)
        if (status === 'CANCELLED' && statusChanged) {
          await cancelOrderTx(tx, current, adminUserId);
        } else {
          const data: Prisma.OrderUpdateInput = {};
          const now = new Date();
          if (status && statusChanged) {
            data.status = status;
            data.events = { create: { status, performedById: adminUserId } };
            if (status === 'SHIPPED' && !current.shippedAt)
              data.shippedAt = now;
            if (status === 'DELIVERED') {
              if (!current.shippedAt) data.shippedAt = now;
              data.deliveredAt = now;
              // Paiement à la livraison ou virement arrivé : la commande livrée est réglée
              data.paymentStatus = 'PAID';
              if (!current.paidAt) data.paidAt = now;
            }
          }
          if (paymentStatus && paymentStatus !== current.paymentStatus) {
            data.paymentStatus = paymentStatus;
            if (paymentStatus === 'PAID' && !current.paidAt) data.paidAt = now;
          }
          await tx.order.update({ where: { id }, data });
        }

        const order = await tx.order.findUniqueOrThrow({
          where: { id },
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
        order.id,
      );
    }

    return formatOrder(order);
  }
}
