import { BadRequestException } from '@nestjs/common';
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/enums';
import { tr } from '../common/i18n';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export const STATUS_LABELS: Record<OrderStatus, { fr: string; en: string }> = {
  PENDING: { fr: 'Reçue', en: 'Received' },
  CONFIRMED: { fr: 'Confirmée', en: 'Confirmed' },
  PREPARING: { fr: 'En préparation', en: 'Being prepared' },
  SHIPPED: { fr: 'Expédiée', en: 'Shipped' },
  DELIVERED: { fr: 'Livrée', en: 'Delivered' },
  CANCELLED: { fr: 'Annulée', en: 'Cancelled' },
};

// Une commande avance sans revenir en arrière ; DELIVERED et CANCELLED sont définitifs
const STATUS_RANK: Record<OrderStatus, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  CANCELLED: 99,
};

export function isFinal(status: OrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED';
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  const label = (s: OrderStatus) => STATUS_LABELS[s];
  if (isFinal(from)) {
    throw new BadRequestException(
      tr(
        `Une commande ${label(from).fr.toLowerCase()} ne peut plus changer de statut`,
        `A ${label(from).en.toLowerCase()} order can no longer change status`,
      ),
    );
  }
  if (to !== 'CANCELLED' && STATUS_RANK[to] < STATUS_RANK[from]) {
    throw new BadRequestException(
      tr(
        `Impossible de repasser de « ${label(from).fr} » à « ${label(to).fr} »`,
        `Cannot go back from "${label(from).en}" to "${label(to).en}"`,
      ),
    );
  }
}

/** Le client peut annuler tant que la préparation n'a pas commencé */
export function customerCanCancel(status: OrderStatus): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

/** Paiement en ligne (carte, PayPal) : réglé à la commande. Virement et espèces : plus tard. */
export function initialPaymentStatus(method: PaymentMethod): PaymentStatus {
  return method === 'CARD' || method === 'PAYPAL' ? 'PAID' : 'PENDING';
}

/** Statut de paiement après une annulation : remboursé si l'argent avait été encaissé */
export function paymentStatusAfterCancel(
  current: PaymentStatus,
): PaymentStatus {
  return current === 'PAID' ? 'REFUNDED' : current;
}
