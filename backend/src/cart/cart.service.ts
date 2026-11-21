import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { int } from '../common/input';
import { tr } from '../common/i18n';

const MAX_QUANTITY = 99;

const CART_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          stockQuantity: true,
          isActive: true,
          images: {
            select: { url: true, altText: true },
            orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // upsert : deux requêtes simultanées ne peuvent pas créer deux paniers
  private getOrCreateCart(userId: number) {
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: CART_INCLUDE,
    });
  }

  async getCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);

    const items = cart.items.map((item) => {
      const unitPrice = Number(item.product.price);
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal: round3(unitPrice * item.quantity),
        product: {
          name: item.product.name,
          slug: item.product.slug,
          stockQuantity: item.product.stockQuantity,
          isAvailable:
            item.product.isActive &&
            item.product.stockQuantity >= item.quantity,
          image: item.product.images[0] ?? null,
        },
      };
    });

    return {
      id: cart.id,
      items,
      total: round3(items.reduce((sum, i) => sum + i.lineTotal, 0)),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }

  async addItem(
    userId: number,
    rawProductId: unknown,
    rawQuantity: unknown = 1,
  ) {
    const productId = int(rawProductId, tr('Produit', 'Product'), { min: 1 });
    const quantity = int(rawQuantity, tr('Quantité', 'Quantity'), {
      min: 1,
      max: MAX_QUANTITY,
    });

    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
    });
    if (!product)
      throw new NotFoundException(
        tr(
          'Produit introuvable ou indisponible',
          'Product not found or unavailable',
        ),
      );

    const cart = await this.getOrCreateCart(userId);
    const existingItem = cart.items.find((i) => i.productId === productId);
    const newQty = (existingItem?.quantity ?? 0) + quantity;

    if (newQty > product.stockQuantity) {
      throw new BadRequestException(
        tr(
          `Stock insuffisant. Stock disponible : ${product.stockQuantity}`,
          `Insufficient stock. Available stock: ${product.stockQuantity}`,
        ),
      );
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: number, itemId: number, rawQuantity: unknown) {
    const quantity = int(rawQuantity, tr('Quantité', 'Quantity'), {
      min: 0,
      max: MAX_QUANTITY,
    });
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item)
      throw new NotFoundException(
        tr('Article non trouvé dans le panier', 'Item not found in the cart'),
      );

    if (quantity === 0) return this.removeItem(userId, itemId);

    if (quantity > item.product.stockQuantity) {
      throw new BadRequestException(
        tr(
          `Stock insuffisant. Stock disponible : ${item.product.stockQuantity}`,
          `Insufficient stock. Available stock: ${item.product.stockQuantity}`,
        ),
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
    return this.getCart(userId);
  }

  async removeItem(userId: number, itemId: number) {
    const cart = await this.getOrCreateCart(userId);
    if (!cart.items.some((i) => i.id === itemId)) {
      throw new NotFoundException(
        tr('Article non trouvé dans le panier', 'Item not found in the cart'),
      );
    }
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clearCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }
}
