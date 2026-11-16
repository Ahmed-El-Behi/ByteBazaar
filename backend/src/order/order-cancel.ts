import type { Prisma } from '../generated/prisma/client';
import type { PaymentStatus } from '../generated/prisma/enums';
import { paymentStatusAfterCancel } from './order-status';

interface CancellableOrder {
  id: number;
  reference: string;
  paymentStatus: PaymentStatus;
  items: { productId: number; quantity: number }[];
}

/**
 * Annule une commande dans une transaction : remise en stock des articles (tracée comme
 * retour), remboursement si le paiement avait été encaissé, entrée dans l'historique.
 * Le statut « annulée » étant définitif, la remise en stock ne peut avoir lieu qu'une fois.
 */
export async function cancelOrderTx(
  tx: Prisma.TransactionClient,
  order: CancellableOrder,
  performedById: number,
) {
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQuantity: { increment: item.quantity } },
    });
  }
  await tx.stockMovement.createMany({
    data: order.items.map((item) => ({
      productId: item.productId,
      performedById,
      quantityChange: item.quantity,
      reason: 'RETURN' as const,
      note: `Annulation commande ${order.reference}`,
    })),
  });
  await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      paymentStatus: paymentStatusAfterCancel(order.paymentStatus),
      events: { create: { status: 'CANCELLED', performedById } },
    },
  });
}
