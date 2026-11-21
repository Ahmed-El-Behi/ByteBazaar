import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { tr } from '../common/i18n';
import { badRequest } from '../common/input';

export const DASHBOARD_PERIODS = [7, 30, 90, 365] as const;
const LOW_STOCK_THRESHOLD = 3;
const DAY = 86_400_000;

// Les jours sont comptés à l'heure de Tunis (UTC+1, sans heure d'été)
const TZ = 'Africa/Tunis';
const TZ_OFFSET = '+01:00';

/** Date du jour à Tunis, au format AAAA-MM-JJ */
export function localDay(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Début (minuit à Tunis) de la période de `days` jours qui se termine aujourd'hui */
export function periodStart(days: number, now = new Date()): Date {
  const today = new Date(`${localDay(now)}T00:00:00${TZ_OFFSET}`);
  return new Date(today.getTime() - (days - 1) * DAY);
}

/** Toutes les étiquettes de la période (jours ou mois), pour une courbe sans trou */
export function periodBuckets(
  from: Date,
  days: number,
  granularity: 'day' | 'month',
): string[] {
  const labels = new Set<string>();
  for (let i = 0; i < days; i++) {
    const day = localDay(new Date(from.getTime() + i * DAY + 12 * 3_600_000));
    labels.add(granularity === 'month' ? day.slice(0, 7) : day);
  }
  return [...labels];
}

const pctChange = (current: number, previous: number) =>
  previous === 0
    ? null
    : Math.round(((current - previous) / previous) * 1000) / 10;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const ACTIVE = Prisma.sql`"status" <> 'CANCELLED'`;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(rawDays?: string) {
    const days = Number(rawDays ?? 30);
    if (!DASHBOARD_PERIODS.includes(days as (typeof DASHBOARD_PERIODS)[number]))
      throw badRequest(
        tr(
          `Période invalide (valeurs possibles : ${DASHBOARD_PERIODS.join(', ')} jours)`,
          `Invalid period (allowed values: ${DASHBOARD_PERIODS.join(', ')} days)`,
        ),
      );

    const from = periodStart(days);
    const previousFrom = new Date(from.getTime() - days * DAY);
    const granularity = days > 90 ? 'month' : 'day';

    const [
      current,
      previous,
      customers,
      previousCustomers,
      timeline,
      statuses,
      payments,
      categories,
      topProducts,
      lowStock,
      lowStockCount,
      outOfStockCount,
      toProcess,
      awaitingPayment,
      recentOrders,
    ] = await Promise.all([
      this.totals(from),
      this.totals(previousFrom, from),
      this.prisma.user.count({ where: { createdAt: { gte: from } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: previousFrom, lt: from } },
      }),
      this.timeline(from, days, granularity),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        { method: string; orders: number; revenue: number }[]
      >`SELECT "paymentMethod"::text AS method, COUNT(*)::int AS orders, COALESCE(SUM("total"), 0)::float AS revenue
        FROM "Order" WHERE "createdAt" >= ${from} AND ${ACTIVE}
        GROUP BY 1 ORDER BY revenue DESC`,
      this.prisma.$queryRaw<
        {
          slug: string;
          nameFr: string;
          nameEn: string;
          quantity: number;
          revenue: number;
        }[]
      >`SELECT root."slug", root."nameFr", root."nameEn",
               SUM(oi."quantity")::int AS quantity,
               SUM(oi."unitPrice" * oi."quantity")::float AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "Product" p ON p."id" = oi."productId"
        JOIN "Category" c ON c."id" = p."categoryId"
        JOIN "Category" root ON root."id" = COALESCE(c."parentId", c."id")
        WHERE o."createdAt" >= ${from} AND o."status" <> 'CANCELLED'
        GROUP BY root."id" ORDER BY revenue DESC`,
      this.topProducts(from),
      this.prisma.product.findMany({
        where: { isActive: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: [{ stockQuantity: 'asc' }, { popularity: 'desc' }],
        take: 8,
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          stockQuantity: true,
          images: {
            select: { url: true },
            orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
            take: 1,
          },
        },
      }),
      this.prisma.product.count({
        where: {
          isActive: true,
          stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD },
        },
      }),
      this.prisma.product.count({
        where: { isActive: true, stockQuantity: 0 },
      }),
      this.prisma.order.count({
        where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
      }),
      this.prisma.order.count({
        where: {
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'PENDING',
          status: { not: 'CANCELLED' },
        },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          reference: true,
          createdAt: true,
          total: true,
          status: true,
          paymentStatus: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const averageBasket = current.orders ? current.revenue / current.orders : 0;
    const previousBasket = previous.orders
      ? previous.revenue / previous.orders
      : 0;

    return {
      period: { days, from, granularity },
      kpis: {
        revenue: round3(current.revenue),
        revenueChange: pctChange(current.revenue, previous.revenue),
        orders: current.orders,
        ordersChange: pctChange(current.orders, previous.orders),
        averageBasket: round3(averageBasket),
        averageBasketChange: pctChange(averageBasket, previousBasket),
        itemsSold: current.items,
        newCustomers: customers,
        newCustomersChange: pctChange(customers, previousCustomers),
        toProcess,
        awaitingPayment,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
      timeline,
      statuses: statuses.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      payments: payments.map((p) => ({ ...p, revenue: round3(p.revenue) })),
      categories: categories.map((c) => ({ ...c, revenue: round3(c.revenue) })),
      topProducts,
      lowStock: lowStock.map(({ images, ...p }) => ({
        ...p,
        image: images[0]?.url ?? null,
      })),
      recentOrders: recentOrders.map((o) => ({ ...o, total: Number(o.total) })),
    };
  }

  private async totals(from: Date, to?: Date) {
    const [row] = await this.prisma.$queryRaw<
      { revenue: number; orders: number; items: number }[]
    >`SELECT COALESCE(SUM(o."total"), 0)::float AS revenue,
             COUNT(*)::int AS orders,
             COALESCE(SUM((SELECT SUM(oi."quantity") FROM "OrderItem" oi WHERE oi."orderId" = o."id")), 0)::int AS items
      FROM "Order" o
      WHERE o."createdAt" >= ${from}
        ${to ? Prisma.sql`AND o."createdAt" < ${to}` : Prisma.empty}
        AND o.${ACTIVE}`;
    return row;
  }

  private async timeline(
    from: Date,
    days: number,
    granularity: 'day' | 'month',
  ) {
    const format = granularity === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const rows = await this.prisma.$queryRaw<
      { bucket: string; revenue: number; orders: number }[]
    >`SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, ${format}) AS bucket,
             SUM("total")::float AS revenue,
             COUNT(*)::int AS orders
      FROM "Order"
      WHERE "createdAt" >= ${from} AND ${ACTIVE}
      GROUP BY 1`;
    const byBucket = new Map(rows.map((r) => [r.bucket, r]));
    return periodBuckets(from, days, granularity).map((bucket) => ({
      bucket,
      revenue: round3(byBucket.get(bucket)?.revenue ?? 0),
      orders: byBucket.get(bucket)?.orders ?? 0,
    }));
  }

  private async topProducts(from: Date) {
    const rows = await this.prisma.$queryRaw<
      { productId: number; quantity: number; revenue: number }[]
    >`SELECT oi."productId", SUM(oi."quantity")::int AS quantity,
             SUM(oi."unitPrice" * oi."quantity")::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."createdAt" >= ${from} AND o."status" <> 'CANCELLED'
      GROUP BY oi."productId" ORDER BY revenue DESC LIMIT 5`;
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((r) => r.productId) } },
      select: {
        id: true,
        name: true,
        slug: true,
        images: {
          select: { url: true },
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          take: 1,
        },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = byId.get(r.productId);
      return {
        id: r.productId,
        name: p?.name ?? '',
        slug: p?.slug ?? '',
        image: p?.images[0]?.url ?? null,
        quantity: r.quantity,
        revenue: round3(r.revenue),
      };
    });
  }
}
