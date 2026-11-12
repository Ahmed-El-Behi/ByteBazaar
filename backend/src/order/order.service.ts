import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { asRecord, badRequest, int, oneOf, text } from '../common/input';

export const SHIPPING_FEE = 7; // TND — doit rester identique à SHIPPING_FEE côté frontend (core/models.ts)

const PAYMENT_METHODS = [
  'CASH_ON_DELIVERY',
  'CARD',
  'PAYPAL',
  'BANK_TRANSFER',
] as const;
const ADDRESS_FIELDS = [
  'recipientName',
  'phone',
  'street',
  'city',
  'governorate',
  'postalCode',
] as const;

const ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }] },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type AddressInput = Omit<Prisma.AddressUncheckedCreateInput, 'id' | 'userId'>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function toOrderDto(order: OrderWithItems) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    items: order.items.map((item) => {
      const unitPrice = Number(item.unitPrice);
      const firstImage = item.product?.images?.[0] ?? null;
      return {
        ...item,
        unitPrice,
        lineTotal: round3(unitPrice * item.quantity),
        product: {
          ...item.product,
          price: Number(item.product.price),
          image: firstImage
            ? { url: firstImage.url, altText: firstImage.altText ?? null }
            : null,
        },
      };
    }),
  };
}

function parseAddress(body: unknown): AddressInput {
  const b = asRecord(body);
  const missing = ADDRESS_FIELDS.filter((key) => !text(b[key]));
  if (missing.length)
    throw badRequest(`Adresse incomplète : ${missing.join(', ')}`);
  return {
    label: text(b.label) || 'Maison',
    recipientName: text(b.recipientName),
    phone: text(b.phone),
    street: text(b.street),
    city: text(b.city),
    governorate: text(b.governorate),
    postalCode: text(b.postalCode),
    isDefault: b.isDefault === true,
  };
}

// Ex. BB-482913-057 (6 chiffres horodatés + 3 aléatoires)
function newReference(): string {
  return `BB-${Date.now().toString().slice(-6)}-${randomInt(1000).toString().padStart(3, '0')}`;
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  // --- ADRESSES ---

  getAddresses(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });
  }

  async createAddress(userId: number, body: unknown) {
    const address = parseAddress(body);
    return this.prisma.$transaction((tx) =>
      this.saveAddress(tx, userId, address),
    );
  }

  private async saveAddress(
    tx: Prisma.TransactionClient,
    userId: number,
    address: AddressInput,
  ) {
    if (address.isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return tx.address.create({ data: { ...address, userId } });
  }

  // --- PASSAGE DE COMMANDE ---

  async checkout(userId: number, body: unknown) {
    const b = asRecord(body);
    const paymentMethod =
      oneOf(b.paymentMethod, PAYMENT_METHODS, 'Mode de paiement') ??
      'CASH_ON_DELIVERY';
    const addressId =
      b.addressId !== undefined && b.addressId !== null
        ? int(b.addressId, 'Adresse', { min: 1 })
        : null;
    const newAddress =
      addressId === null && b.newAddress ? parseAddress(b.newAddress) : null;
    if (addressId === null && !newAddress) {
      throw new BadRequestException(
        'Veuillez sélectionner ou fournir une adresse de livraison',
      );
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const orderId = await this.prisma.$transaction((tx) =>
          this.placeOrder(tx, userId, paymentMethod, addressId, newAddress),
        );
        return this.getOrderDetails(userId, orderId);
      } catch (error) {
        // Collision (très improbable) sur la référence unique : on réessaie avec une nouvelle référence
        const collision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          JSON.stringify(error.meta ?? {}).includes('reference');
        if (!collision || attempt >= 3) throw error;
      }
    }
  }

  private async placeOrder(
    tx: Prisma.TransactionClient,
    userId: number,
    paymentMethod: (typeof PAYMENT_METHODS)[number],
    addressId: number | null,
    newAddress: AddressInput | null,
  ): Promise<number> {
    // Le panier est lu dans la transaction : prix et quantités sont ceux du moment de la commande
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: {
        items: { include: { product: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!cart?.items.length)
      throw new BadRequestException('Votre panier est vide');

    const address = addressId
      ? await tx.address.findFirst({ where: { id: addressId, userId } })
      : await this.saveAddress(tx, userId, newAddress!);
    if (!address) throw new NotFoundException('Adresse spécifiée non trouvée');

    // Réservation du stock : décrément conditionnel atomique (aucune survente possible
    // même si deux commandes du même produit arrivent en même temps)
    for (const item of cart.items) {
      const reserved = await tx.product.updateMany({
        where: {
          id: item.productId,
          isActive: true,
          stockQuantity: { gte: item.quantity },
        },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (reserved.count === 0) {
        if (!item.product.isActive) {
          throw new BadRequestException(
            `Le produit ${item.product.name} n'est plus disponible à la vente`,
          );
        }
        throw new BadRequestException(
          `Le produit ${item.product.name} n'a pas assez de stock (${item.product.stockQuantity} disponible)`,
        );
      }
    }

    const subtotal = round3(
      cart.items.reduce(
        (sum, i) => sum + Number(i.product.price) * i.quantity,
        0,
      ),
    );
    const order = await tx.order.create({
      data: {
        userId,
        reference: newReference(),
        paymentMethod,
        subtotal,
        shippingFee: SHIPPING_FEE,
        total: round3(subtotal + SHIPPING_FEE),
        shippingName: address.recipientName,
        shippingPhone: address.phone,
        shippingAddress: `${address.street}, ${address.city}, ${address.governorate} ${address.postalCode}`,
        items: {
          create: cart.items.map((i) => ({
            productId: i.productId,
            productName: i.product.name,
            unitPrice: i.product.price,
            quantity: i.quantity,
          })),
        },
      },
    });

    await tx.stockMovement.createMany({
      data: cart.items.map((i) => ({
        productId: i.productId,
        quantityChange: -i.quantity,
        reason: 'SALE' as const,
        note: `Commande ${order.reference}`,
      })),
    });

    // Seules les lignes commandées sont retirées du panier
    await tx.cartItem.deleteMany({
      where: { id: { in: cart.items.map((i) => i.id) } },
    });
    return order.id;
  }

  // --- HISTORIQUE ---

  async getMyOrders(userId: number) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return orders.map(toOrderDto);
  }

  async getOrderDetails(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    return toOrderDto(order);
  }
}
