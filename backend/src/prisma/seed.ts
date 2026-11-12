import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// =====================================================================
// Import du catalogue : data/catalogue_local_images_cleaned.json est la
// source de vérité (noms normalisés par scripts/normalize_catalogue.py).
//
//  - Catégories, marques et produits sont créés ou mis à jour (par SKU).
//  - Le stock existant n'est jamais écrasé (voir seed-stock.ts).
//  - Les produits absents du fichier sont supprimés s'ils ne sont liés à
//    aucune commande / panier / configuration, sinon simplement désactivés.
//  - Les catégories et marques devenues vides sont supprimées.
//
// Le script est relançable à volonté.
// =====================================================================

type CatalogueImage = {
  url: string;
  altText?: string | null;
  position?: number;
  isPrimary?: boolean;
};
type CatalogueSpec = {
  name: string;
  valueText: string;
  valueNumber?: number | null;
  unit?: string | null;
};

type CatalogueProduct = {
  sku: string;
  slug: string;
  name: string;
  descriptionFr: string;
  descriptionEn: string;
  price: string | number;
  stockQuantity?: number;
  isActive?: boolean;
  categorySlug: string;
  brandName: string;
  images?: CatalogueImage[];
  specs?: CatalogueSpec[];
  source?: { ratingCount?: number };
};

type CatalogueFile = {
  categories: Array<{ slug: string; nameFr: string; nameEn: string }>;
  brands: Array<{ name: string; slug: string }>;
  products: CatalogueProduct[];
};

const CATALOGUE_PATH = resolve(
  process.cwd(),
  'data',
  'catalogue_local_images_cleaned.json',
);
const BATCH_SIZE = 50;

function loadCatalogue(): CatalogueFile {
  if (!existsSync(CATALOGUE_PATH)) {
    throw new Error(`Catalogue introuvable : ${CATALOGUE_PATH}`);
  }
  const catalogue = JSON.parse(
    readFileSync(CATALOGUE_PATH, 'utf8'),
  ) as CatalogueFile;
  if (
    !Array.isArray(catalogue?.categories) ||
    !Array.isArray(catalogue.brands) ||
    !Array.isArray(catalogue.products)
  ) {
    throw new Error(
      'Format JSON invalide : categories, brands et products sont obligatoires.',
    );
  }
  if (!catalogue.products.length)
    throw new Error('Le catalogue ne contient aucun produit.');

  const skus = new Set<string>();
  for (const product of catalogue.products) {
    if (skus.has(product.sku))
      throw new Error(`SKU en double dans le catalogue : ${product.sku}`);
    skus.add(product.sku);
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0)
      throw new Error(`Prix invalide pour ${product.sku} : ${product.price}`);
  }
  return catalogue;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL est absent du fichier .env.');

  const catalogue = loadCatalogue();
  console.log('\n===== IMPORT DU CATALOGUE BYTEBAZAAR =====');
  console.log(
    `Catégories : ${catalogue.categories.length} | Marques : ${catalogue.brands.length} | Produits : ${catalogue.products.length}`,
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // 1. Catégories
    const categoryIds = new Map<string, number>();
    for (const [index, c] of catalogue.categories.entries()) {
      const data = {
        nameFr: c.nameFr,
        nameEn: c.nameEn,
        sortOrder: index + 1,
        parentId: null,
      };
      const saved = await prisma.category.upsert({
        where: { slug: c.slug },
        update: data,
        create: { slug: c.slug, ...data },
      });
      categoryIds.set(c.slug, saved.id);
    }
    console.log(`✓ ${categoryIds.size} catégories`);

    // 2. Marques (recherche par nom puis par slug pour éviter les conflits d'unicité)
    const brandIds = new Map<string, number>();
    for (const b of catalogue.brands) {
      const existing =
        (await prisma.brand.findUnique({ where: { name: b.name } })) ??
        (await prisma.brand.findUnique({ where: { slug: b.slug } }));
      const saved = existing
        ? await prisma.brand.update({
            where: { id: existing.id },
            data: { name: b.name },
          })
        : await prisma.brand.create({ data: { name: b.name, slug: b.slug } });
      brandIds.set(b.name, saved.id);
    }
    console.log(`✓ ${brandIds.size} marques`);

    // 3. Produits, par lots transactionnels
    const existingSkus = new Set(
      (await prisma.product.findMany({ select: { sku: true } })).map(
        (p) => p.sku,
      ),
    );
    let created = 0;
    let updated = 0;

    for (
      let start = 0;
      start < catalogue.products.length;
      start += BATCH_SIZE
    ) {
      const batch = catalogue.products.slice(start, start + BATCH_SIZE);

      await prisma.$transaction(
        async (tx) => {
          for (const product of batch) {
            const categoryId = categoryIds.get(product.categorySlug);
            const brandId = brandIds.get(product.brandName);
            if (categoryId === undefined)
              throw new Error(
                `Catégorie "${product.categorySlug}" inconnue (${product.sku})`,
              );
            if (brandId === undefined)
              throw new Error(
                `Marque "${product.brandName}" inconnue (${product.sku})`,
              );

            const fields = {
              slug: product.slug,
              name: product.name,
              descriptionFr: product.descriptionFr,
              descriptionEn: product.descriptionEn,
              price: Number(product.price),
              isActive: product.isActive ?? true,
              popularity: product.source?.ratingCount ?? 0,
              categoryId,
              brandId,
            };

            const saved = await tx.product.upsert({
              where: { sku: product.sku },
              update: fields, // le stock existant est conservé
              create: {
                sku: product.sku,
                stockQuantity: product.stockQuantity ?? 0,
                ...fields,
              },
              select: { id: true },
            });

            await tx.productImage.deleteMany({
              where: { productId: saved.id },
            });
            const images = (product.images ?? [])
              .filter(
                (img) => typeof img.url === 'string' && img.url.trim() !== '',
              )
              .map((img, i) => ({
                productId: saved.id,
                url: img.url,
                altText: img.altText ?? product.name,
                position: img.position ?? i,
                isPrimary: img.isPrimary ?? i === 0,
              }));
            if (images.length)
              await tx.productImage.createMany({ data: images });

            await tx.productSpec.deleteMany({ where: { productId: saved.id } });
            const specs = (product.specs ?? []).map((s) => ({
              productId: saved.id,
              name: s.name,
              valueText: s.valueText,
              valueNumber: s.valueNumber ?? null,
              unit: s.unit ?? null,
            }));
            if (specs.length) await tx.productSpec.createMany({ data: specs });

            if (existingSkus.has(product.sku)) updated++;
            else created++;
          }
        },
        { timeout: 120_000 },
      );

      console.log(
        `Progression : ${Math.min(start + BATCH_SIZE, catalogue.products.length)}/${catalogue.products.length}`,
      );
    }

    // 4. Produits qui ne figurent plus dans le catalogue
    const catalogueSkus = catalogue.products.map((p) => p.sku);
    const stale = await prisma.product.findMany({
      where: { sku: { notIn: catalogueSkus } },
      select: {
        id: true,
        _count: {
          select: {
            orderItems: true,
            cartItems: true,
            configurationItems: true,
          },
        },
      },
    });
    const referenced = stale.filter(
      (p) =>
        p._count.orderItems ||
        p._count.cartItems ||
        p._count.configurationItems,
    );
    const removable = stale
      .filter((p) => !referenced.includes(p))
      .map((p) => p.id);

    if (removable.length) {
      await prisma.$transaction([
        prisma.stockMovement.deleteMany({
          where: { productId: { in: removable } },
        }),
        prisma.product.deleteMany({ where: { id: { in: removable } } }),
      ]);
    }
    if (referenced.length) {
      // Conservés pour l'historique des commandes, mais retirés de la vente
      await prisma.product.updateMany({
        where: { id: { in: referenced.map((p) => p.id) } },
        data: { isActive: false },
      });
    }

    // 5. Catégories et marques sans aucun produit
    const emptyCategories = await prisma.category.deleteMany({
      where: {
        products: { none: {} },
        children: { none: {} },
        slug: { notIn: [...categoryIds.keys()] },
      },
    });
    // Les racines devenues vides après suppression de leurs enfants
    const emptyRoots = await prisma.category.deleteMany({
      where: {
        products: { none: {} },
        children: { none: {} },
        slug: { notIn: [...categoryIds.keys()] },
      },
    });
    const emptyBrands = await prisma.brand.deleteMany({
      where: { products: { none: {} } },
    });

    const [categoryCount, brandCount, productCount, activeCount] =
      await Promise.all([
        prisma.category.count(),
        prisma.brand.count(),
        prisma.product.count(),
        prisma.product.count({ where: { isActive: true } }),
      ]);

    console.log('\n========== IMPORT TERMINÉ ==========');
    console.log(`Produits créés : ${created} | mis à jour : ${updated}`);
    console.log(
      `Produits obsolètes supprimés : ${removable.length} | désactivés (liés à des commandes) : ${referenced.length}`,
    );
    console.log(
      `Catégories vides supprimées : ${emptyCategories.count + emptyRoots.count} | marques vides supprimées : ${emptyBrands.count}`,
    );
    console.log(
      `En base : ${categoryCount} catégories, ${brandCount} marques, ${productCount} produits (${activeCount} actifs)`,
    );
    console.log('====================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\nÉCHEC DE L’IMPORTATION :', error);
  process.exitCode = 1;
});
