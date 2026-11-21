import type { Prisma } from '../generated/prisma/client';
import type { OrderStatus } from '../generated/prisma/enums';

// Filtres de la page « Commandes » de l'administration : appliqués par la base (liste paginée)
export const ADMIN_ORDER_FILTERS = [
  'toutes',
  'a-traiter',
  'expediees',
  'livrees',
  'annulees',
  'virements',
] as const;
export type AdminOrderFilter = (typeof ADMIN_ORDER_FILTERS)[number];

const TO_PROCESS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING'];

/** Virement non encore reçu, sur une commande toujours en cours */
const PENDING_TRANSFER: Prisma.OrderWhereInput = {
  paymentMethod: 'BANK_TRANSFER',
  paymentStatus: 'PENDING',
  status: { not: 'CANCELLED' },
};

export function filterWhere(filter: AdminOrderFilter): Prisma.OrderWhereInput {
  switch (filter) {
    case 'a-traiter':
      return { status: { in: TO_PROCESS } };
    case 'expediees':
      return { status: 'SHIPPED' };
    case 'livrees':
      return { status: 'DELIVERED' };
    case 'annulees':
      return { status: 'CANCELLED' };
    case 'virements':
      return PENDING_TRANSFER;
    default:
      return {};
  }
}

export const pendingTransferWhere = (): Prisma.OrderWhereInput =>
  PENDING_TRANSFER;

/**
 * Recherche : chaque mot doit apparaître dans la référence, le nom, l'e-mail ou le téléphone
 * (du client ou de la livraison), sans tenir compte de la casse.
 */
export function searchWhere(query: string): Prisma.OrderWhereInput[] {
  const words = query.trim().slice(0, 100).split(/\s+/).filter(Boolean);
  return words.map((word) => {
    const contains = { contains: word, mode: 'insensitive' as const };
    return {
      OR: [
        { reference: contains },
        { shippingName: contains },
        { shippingPhone: contains },
        {
          user: {
            is: {
              OR: [
                { firstName: contains },
                { lastName: contains },
                { email: contains },
                { phone: contains },
              ],
            },
          },
        },
      ],
    };
  });
}

/** Compteurs des filtres, à partir du nombre de commandes par statut et des virements en attente */
export function filterCounts(
  byStatus: { status: OrderStatus; count: number }[],
  pendingTransfers: number,
): Record<AdminOrderFilter, number> {
  const of = (...statuses: OrderStatus[]) =>
    byStatus
      .filter((g) => statuses.includes(g.status))
      .reduce((sum, g) => sum + g.count, 0);
  return {
    toutes: byStatus.reduce((sum, g) => sum + g.count, 0),
    'a-traiter': of(...TO_PROCESS),
    expediees: of('SHIPPED'),
    livrees: of('DELIVERED'),
    annulees: of('CANCELLED'),
    virements: pendingTransfers,
  };
}
