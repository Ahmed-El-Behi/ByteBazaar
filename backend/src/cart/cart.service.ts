import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: number) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
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
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
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
            orderBy: { id: 'asc' },
          },
        },
      });
    }

    return cart;
  }

  async getCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);
    
    let total = 0;
    const items = cart.items.map((item) => {
      const unitPrice = Number(item.product.price);
      const lineTotal = unitPrice * item.quantity;
      total += lineTotal;

      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        product: {
          name: item.product.name,
          slug: item.product.slug,
          stockQuantity: item.product.stockQuantity,
          isAvailable: item.product.isActive && item.product.stockQuantity >= item.quantity,
          image: item.product.images[0] ?? null,
        },
      };
    });

    return {
      id: cart.id,
      items,
      total,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }

  async addItem(userId: number, productId: number, quantity: number) {
    if (quantity <= 0) throw new BadRequestException('La quantité doit être supérieure à 0');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable ou indisponible');

    const cart = await this.getOrCreateCart(userId);
    const existingItem = cart.items.find((i) => i.productId === productId);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const newQty = currentQty + quantity;

    if (newQty > product.stockQuantity) {
      throw new BadRequestException(`Stock insuffisant. Stock disponible : ${product.stockQuantity}`);
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: number, itemId: number, quantity: number) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Article non trouvé dans le panier');

    if (quantity <= 0) {
      return this.removeItem(userId, itemId);
    }

    if (quantity > item.product.stockQuantity) {
      throw new BadRequestException(`Stock insuffisant. Stock disponible : ${item.product.stockQuantity}`);
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: number, itemId: number) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Article non trouvé dans le panier');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clearCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }
}