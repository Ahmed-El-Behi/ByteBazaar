import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CheckoutDto, CreateAddressDto } from './order.dto';

const PAYMENT_METHODS = ['CASH_ON_DELIVERY', 'CARD', 'PAYPAL', 'BANK_TRANSFER'] as const;
const ADDRESS_FIELDS = ['recipientName', 'phone', 'street', 'city', 'governorate', 'postalCode'] as const;

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Convertit les Decimal en nombres et ajoute lineTotal (calculé, non stocké en base)
function toOrderDto(order: OrderWithItems) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    items: order.items.map((item) => {
      const unitPrice = Number(item.unitPrice);
      return { ...item, unitPrice, lineTotal: round3(unitPrice * item.quantity) };
    }),
  };
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  // --- GESTION DES ADRESSES ---
  async getAddresses(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });
  }

  async createAddress(userId: number, dto: CreateAddressDto) {
    const missing = ADDRESS_FIELDS.filter((key) => typeof dto?.[key] !== 'string' || !dto[key].trim());
    if (missing.length) {
      throw new BadRequestException(`Adresse incomplète : ${missing.join(', ')}`);
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        label: dto.label || 'Maison',
        recipientName: dto.recipientName,
        phone: dto.phone,
        street: dto.street,
        city: dto.city,
        governorate: dto.governorate,
        postalCode: dto.postalCode,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  // --- PASSAGE DE COMMANDE ---
  async checkout(userId: number, dto: CheckoutDto) {
    const paymentMethod = dto.paymentMethod ?? 'CASH_ON_DELIVERY';
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new BadRequestException('Mode de paiement invalide');
    }

    const cart = await this.cartService.getCart(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Votre panier est vide');
    }

    // Récupération ou création de l'adresse
    let address;
    if (dto.addressId) {
      address = await this.prisma.address.findFirst({
        where: { id: dto.addressId, userId },
      });
      if (!address) throw new NotFoundException('Adresse spécifiée non trouvée');
    } else if (dto.newAddress) {
      address = await this.createAddress(userId, dto.newAddress);
    } else {
      throw new BadRequestException('Veuillez sélectionner ou fournir une adresse de livraison');
    }

    // Transaction atomique : vérification stock, création commande, mouvement de stock, vidage panier
    const created = await this.prisma.$transaction(async (tx) => {
      // 1. Vérification stricte des stocks
      for (const item of cart.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod || prod.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Le produit ${item.product.name} n'a pas assez de stock (${prod?.stockQuantity ?? 0} disponible)`,
          );
        }
      }

      const shippingFee = 7.0; // Frais de livraison forfaitaires en TND
      const subtotal = cart.total;
      const total = subtotal + shippingFee;
      const reference = `BB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      // 2. Création de la commande
      const order = await tx.order.create({
        data: {
          userId,
          reference,
          status: 'PENDING',
          paymentMethod,
          paymentStatus: 'PENDING',
          subtotal,
          shippingFee,
          total,
          shippingName: address.recipientName,
          shippingPhone: address.phone,
          shippingAddress: `${address.street}, ${address.city}, ${address.governorate} ${address.postalCode}`,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              productName: i.product.name,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // 3. Décrémentation des stocks et écriture des StockMovements (SALE)
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantityChange: -item.quantity,
            reason: 'SALE',
            note: `Commande ${order.reference}`,
          },
        });
      }

      // 4. Vider le panier
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });

    return toOrderDto(created);
  }

  async getMyOrders(userId: number) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return orders.map(toOrderDto);
  }

  async getOrderDetails(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    return toOrderDto(order);
  }
}