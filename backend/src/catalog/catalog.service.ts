import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ProductQuery = Record<string, string | undefined>;

const SORTS = new Map<string, Prisma.ProductOrderByWithRelationInput[]>([
  ['newest', [{ createdAt: 'desc' }, { id: 'asc' }]],
  ['price_asc', [{ price: 'asc' }, { id: 'asc' }]],
  ['price_desc', [{ price: 'desc' }, { id: 'asc' }]],
  ['name', [{ name: 'asc' }, { id: 'asc' }]],
]);

const RAM_TYPES = ['DDR4', 'DDR5'] as const;

const LIST_SELECT = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  price: true,
  stockQuantity: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { slug: true, nameFr: true, nameEn: true } },
  images: {
    select: { url: true, altText: true },
    orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

type ListRow = Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>;

function toPositiveInt(value: string | undefined, fallback: number, max: number) {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function toNumber(value: string | undefined) {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Convertit les Decimal en nombres et retire productId
function describeTechnical(kind: string, row: object) {
  const fields = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key !== 'productId')
      .map(([key, value]) => [key, Prisma.Decimal.isDecimal(value) ? Number(value) : value]),
  );
  return { kind, ...fields };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    const fields = { id: true, slug: true, nameFr: true, nameEn: true } as const;
    return this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        ...fields,
        _count: { select: { products: true } },
        children: {
          orderBy: { sortOrder: 'asc' },
          select: { ...fields, _count: { select: { products: true } } },
        },
      },
    });
  }

  listBrands() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }

  async listProducts(query: ProductQuery) {
    // Une valeur répétée (?brand=a&brand=b) arrive sous forme de tableau
    const get = (key: string): string | undefined => {
      const value = query[key] as unknown;
      if (Array.isArray(value)) return value.join(',');
      return typeof value === 'string' ? value : undefined;
    };

    const page = toPositiveInt(get('page'), 1, 100000);
    const limit = toPositiveInt(get('limit'), 12, 48);
    const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

    // Catégorie : accepte une racine (composants) ou une sous-catégorie (processeurs)
    const category = get('category');
    if (category) {
      and.push({ category: { OR: [{ slug: category }, { parent: { slug: category } }] } });
    }

    // Marques : ?brand=amd,intel
    const brands = get('brand')?.split(',').map((s) => s.trim()).filter(Boolean);
    if (brands?.length) and.push({ brand: { slug: { in: brands } } });

    // Prix en TND
    const minPrice = toNumber(get('minPrice'));
    const maxPrice = toNumber(get('maxPrice'));
    if (minPrice !== undefined || maxPrice !== undefined) {
      and.push({ price: { gte: minPrice, lte: maxPrice } });
    }

    if (get('inStock') === 'true') and.push({ stockQuantity: { gt: 0 } });

    // Filtres techniques (utiles pour le configurateur)
    const socket = get('socket');
    if (socket) {
      const match = { equals: socket, mode: 'insensitive' } as const;
      and.push({
        OR: [{ cpu: { is: { socket: match } } }, { motherboard: { is: { socket: match } } }],
      });
    }
    const ramType = RAM_TYPES.find((t) => t === get('ramType')?.toUpperCase());
    if (ramType) {
      and.push({ OR: [{ ram: { is: { type: ramType } } }, { motherboard: { is: { ramType } } }] });
    }

    // Recherche texte : nom, SKU ou marque
    const q = get('q')?.trim();
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = { AND: and };
    const orderBy = SORTS.get(get('sort') ?? '') ?? SORTS.get('newest')!;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_SELECT,
      }),
    ]);

    return {
      data: rows.map((p) => this.toListItem(p)),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        brand: { select: { name: true, slug: true, logoUrl: true } },
        category: { select: { slug: true, nameFr: true, nameEn: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }] },
        specs: { orderBy: { id: 'asc' } },
        cpu: true,
        motherboard: true,
        ram: true,
        gpu: true,
        powerSupply: true,
        pcCase: true,
      },
    });
    if (!product) throw new NotFoundException(`Produit introuvable : ${slug}`);

    const { cpu, motherboard, ram, gpu, powerSupply, pcCase, ...base } = product;
    const technical = cpu
      ? describeTechnical('cpu', cpu)
      : motherboard
        ? describeTechnical('motherboard', motherboard)
        : ram
          ? describeTechnical('ram', ram)
          : gpu
            ? describeTechnical('gpu', gpu)
            : powerSupply
              ? describeTechnical('powerSupply', powerSupply)
              : pcCase
                ? describeTechnical('pcCase', pcCase)
                : null;

    return {
      ...base,
      price: Number(base.price),
      isAvailable: base.isActive && base.stockQuantity > 0,
      specs: base.specs.map((s) => ({
        ...s,
        valueNumber: s.valueNumber === null ? null : Number(s.valueNumber),
      })),
      technical,
    };
  }

  private toListItem(p: ListRow) {
    const { images, price, ...rest } = p;
    return {
      ...rest,
      price: Number(price),
      isAvailable: p.stockQuantity > 0,
      image: images[0] ?? null,
    };
  }
}