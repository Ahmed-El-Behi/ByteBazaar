import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CheckoutDto, CreateAddressDto } from './order.dto';

const PAYMENT_METHODS = ['CASH_ON_DELIVERY', 'CARD', 'PAYPAL', 'BANK_TRANSFER'] as const;
const ADDRESS_FIELDS = ['recipientName', 'phone', 'street', 'city', 'governorate', 'postalCode'] as const;

// Utilisation de 'images' (au pluriel) pour correspondre au schéma Prisma
type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: {
          include: { images: true };
        };
      };
    };
  };
}>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function toOrderDto(order: OrderWithItems) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    total: Number(order.total),
    items: order.items.map((item) => {
      const unitPrice = Number(item.unitPrice);
      // Récupère la première image du tableau 'images' ou null
      const firstImage = item.product?.images?.[0] ?? null;
      return {
        ...item,
        unitPrice,
        lineTotal: round3(unitPrice * item.quantity),
        product: {
          ...item.product,
          image: firstImage ? { url: firstImage.url, altText: firstImage.altText ?? null } : null,
        },
      };
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

    const orderId = await this.prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod || prod.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Le produit ${item.product.name} n'a pas assez de stock (${prod?.stockQuantity ?? 0} disponible)`,
          );
        }
      }

      const shippingFee = 7.0;
      const subtotal = cart.total;
      const total = subtotal + shippingFee;
      const reference = `BB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

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
      });

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

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order.id;
    });

    // Récupération complète typée avec la relation produits/images
    return this.getOrderDetails(userId, orderId);
  }

  async getMyOrders(userId: number) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              include: { images: true },
            },
          },
        },
      },
    });
    return orders.map(toOrderDto);
  }

  async getOrderDetails(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            product: {
              include: { images: true },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    return toOrderDto(order);
  }
}