import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { relevanceOrder } from './relevance';

export type ProductQuery = Record<string, string | undefined>;

const SORTS = new Map<string, Prisma.ProductOrderByWithRelationInput[]>([
  ['newest', [{ createdAt: 'desc' }, { id: 'asc' }]],
  ['price_asc', [{ price: 'asc' }, { id: 'asc' }]],
  ['price_desc', [{ price: 'desc' }, { id: 'asc' }]],
  ['name', [{ name: 'asc' }, { id: 'asc' }]],
]);
const DEFAULT_SORT = 'relevance';

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

const ACTIVE_PRODUCTS = {
  _count: { select: { products: { where: { isActive: true } } } },
} as const;

function toPositiveInt(
  value: string | undefined,
  fallback: number,
  max: number,
) {
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
      .map(([key, value]) => [
        key,
        Prisma.Decimal.isDecimal(value) ? Number(value) : value,
      ]),
  );
  return { kind, ...fields };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // Seules les catégories qui contiennent des produits en vente sont renvoyées
  async listCategories() {
    const fields = {
      id: true,
      slug: true,
      nameFr: true,
      nameEn: true,
    } as const;
    const roots = await this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        ...fields,
        ...ACTIVE_PRODUCTS,
        children: {
          orderBy: { sortOrder: 'asc' },
          select: { ...fields, ...ACTIVE_PRODUCTS },
        },
      },
    });

    return roots
      .map((root) => ({
        ...root,
        children: root.children.filter((c) => c._count.products > 0),
      }))
      .filter((root) => root._count.products > 0 || root.children.length > 0);
  }

  listBrands() {
    return this.prisma.brand.findMany({
      where: { products: { some: { isActive: true } } },
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

    // Catégorie : accepte une racine ou une sous-catégorie
    const category = get('category');
    if (category) {
      and.push({
        category: { OR: [{ slug: category }, { parent: { slug: category } }] },
      });
    }

    // Marques : ?brand=amd,intel
    const brands = get('brand')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
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
        OR: [
          { cpu: { is: { socket: match } } },
          { motherboard: { is: { socket: match } } },
        ],
      });
    }
    const ramType = RAM_TYPES.find((t) => t === get('ramType')?.toUpperCase());
    if (ramType) {
      and.push({
        OR: [
          { ram: { is: { type: ramType } } },
          { motherboard: { is: { ramType } } },
        ],
      });
    }

    // Recherche : chaque mot doit apparaître dans le nom, le SKU, la marque ou la catégorie
    // ("msi 4070" trouve "MSI GeForce RTX 4070 ...", "souris logitech" trouve "Logitech G305 ...")
    const q = get('q')?.trim().slice(0, 100) ?? '';
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 8);
    for (const term of terms) {
      const contains = { contains: term, mode: 'insensitive' } as const;
      and.push({
        OR: [
          { name: contains },
          { sku: contains },
          { brand: { name: contains } },
          { category: { nameFr: contains } },
          { category: { nameEn: contains } },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = { AND: and };
    const sort = get('sort') ?? DEFAULT_SORT;
    const skip = (page - 1) * limit;

    let total: number;
    let rows: ListRow[];

    if (SORTS.has(sort)) {
      [total, rows] = await this.prisma.$transaction([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          orderBy: SORTS.get(sort),
          skip,
          take: limit,
          select: LIST_SELECT,
        }),
      ]);
    } else {
      // Pertinence : le score est calculé en mémoire sur les candidats (quelques milliers de lignes
      // légères au plus), puis seule la page demandée est chargée en détail.
      const candidates = await this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          popularity: true,
          stockQuantity: true,
          categoryId: true,
          brand: { select: { name: true } },
        },
      });
      total = candidates.length;
      const pageIds = relevanceOrder(candidates, q).slice(skip, skip + limit);
      const found = await this.prisma.product.findMany({
        where: { id: { in: pageIds } },
        select: LIST_SELECT,
      });
      const byId = new Map(found.map((p) => [p.id, p]));
      rows = pageIds.map((id) => byId.get(id)).filter((p): p is ListRow => !!p);
    }

    return {
      data: rows.map((p) => this.toListItem(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
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
        monitor: true,
        mouse: true,
        keyboard: true,
        headset: true,
        speaker: true,
        webcam: true,
      },
    });
    if (!product) throw new NotFoundException(`Produit introuvable : ${slug}`);

    const {
      cpu,
      motherboard,
      ram,
      gpu,
      powerSupply,
      pcCase,
      monitor,
      mouse,
      keyboard,
      headset,
      speaker,
      webcam,
      popularity: _popularity,
      ...base
    } = product;
    const [kind, row] =
      (
        [
          ['cpu', cpu],
          ['motherboard', motherboard],
          ['ram', ram],
          ['gpu', gpu],
          ['powerSupply', powerSupply],
          ['pcCase', pcCase],
          ['monitor', monitor],
          ['mouse', mouse],
          ['keyboard', keyboard],
          ['headset', headset],
          ['speaker', speaker],
          ['webcam', webcam],
        ] as const
      ).find(([, value]) => value) ?? [];

    return {
      ...base,
      price: Number(base.price),
      isAvailable: base.isActive && base.stockQuantity > 0,
      specs: base.specs.map((s) => ({
        ...s,
        valueNumber: s.valueNumber === null ? null : Number(s.valueNumber),
      })),
      technical: kind && row ? describeTechnical(kind, row) : null,
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
