
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

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
};

type CatalogueFile = {
  metadata?: {
    productCount?: number;
    currency?: string;
  };
  categories: Array<{
    slug: string;
    nameFr: string;
    nameEn: string;
  }>;
  brands: Array<{
    name: string;
    slug: string;
  }>;
  products: CatalogueProduct[];
};

const cataloguePath = resolve(
  process.cwd(),
  'data',
  'catalogue_local_images_cleaned.json',
);

function loadCatalogue(): CatalogueFile {
  if (!existsSync(cataloguePath)) {
    throw new Error(
      `Catalogue introuvable : ${cataloguePath}\n` +
        'Le fichier doit être dans backend/data/catalogue_local_images.json.',
    );
  }

  const catalogue = JSON.parse(
    readFileSync(cataloguePath, 'utf8'),
  ) as CatalogueFile;

  if (
    !catalogue ||
    !Array.isArray(catalogue.categories) ||
    !Array.isArray(catalogue.brands) ||
    !Array.isArray(catalogue.products)
  ) {
    throw new Error(
      'Format JSON invalide : categories, brands et products sont obligatoires.',
    );
  }

  if (catalogue.products.length !== 2997) {
    throw new Error(
      `Le catalogue doit contenir 2997 produits. Trouvé : ${catalogue.products.length}.`,
    );
  }

  return catalogue;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL est absent du fichier .env.');
  }

  const catalogue = loadCatalogue();

  console.log('\n===== IMPORT DU CATALOGUE BYTEBAZAAR =====');
  console.log(`Fichier : ${cataloguePath}`);
  console.log(`Catégories : ${catalogue.categories.length}`);
  console.log(`Marques : ${catalogue.brands.length}`);
  console.log(`Produits : ${catalogue.products.length}`);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await prisma.$connect();

    // 1. Catégories
    const categoryIds = new Map<string, number>();

    for (const [index, category] of catalogue.categories.entries()) {
      const savedCategory = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          nameFr: category.nameFr,
          nameEn: category.nameEn,
          sortOrder: index + 1,
        },
        create: {
          slug: category.slug,
          nameFr: category.nameFr,
          nameEn: category.nameEn,
          sortOrder: index + 1,
        },
      });

      categoryIds.set(category.slug, savedCategory.id);
    }

    console.log(`✓ ${categoryIds.size} catégories traitées`);

    // 2. Marques
    // Recherche par nom d'abord pour éviter le conflit P2002.
    const brandIds = new Map<string, number>();

    for (const brand of catalogue.brands) {
      const existingByName = await prisma.brand.findUnique({
        where: { name: brand.name },
      });

      if (existingByName) {
        brandIds.set(brand.name, existingByName.id);
        continue;
      }

      const existingBySlug = await prisma.brand.findUnique({
        where: { slug: brand.slug },
      });

      if (existingBySlug) {
        const updatedBrand = await prisma.brand.update({
          where: { id: existingBySlug.id },
          data: { name: brand.name },
        });

        brandIds.set(brand.name, updatedBrand.id);
        continue;
      }

      const createdBrand = await prisma.brand.create({
        data: {
          name: brand.name,
          slug: brand.slug,
        },
      });

      brandIds.set(brand.name, createdBrand.id);
    }

    console.log(`✓ ${brandIds.size} marques traitées`);

    // 3. Produits
    let created = 0;
    let updated = 0;

    for (let index = 0; index < catalogue.products.length; index++) {
      const product = catalogue.products[index];

      const categoryId = categoryIds.get(product.categorySlug);
      const brandId = brandIds.get(product.brandName);

      if (categoryId === undefined) {
        throw new Error(
          `Catégorie "${product.categorySlug}" introuvable pour ${product.sku}.`,
        );
      }

      if (brandId === undefined) {
        throw new Error(
          `Marque "${product.brandName}" introuvable pour ${product.sku}.`,
        );
      }

      const numericPrice = Number(product.price);

      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error(
          `Prix invalide pour ${product.sku} : ${product.price}`,
        );
      }

      const existingProduct = await prisma.product.findUnique({
        where: { sku: product.sku },
        select: { id: true },
      });

      // 4. Création ou mise à jour du produit
      // Les images et les specs sont traitées séparément.
      const savedProduct = await prisma.product.upsert({
        where: { sku: product.sku },

        update: {
          slug: product.slug,
          name: product.name,
          descriptionFr: product.descriptionFr,
          descriptionEn: product.descriptionEn,
          price: numericPrice,
          isActive: product.isActive ?? true,
          category: {
            connect: { id: categoryId },
          },
          brand: {
            connect: { id: brandId },
          },
          // On conserve le stock existant lors d'une mise à jour.
        },

        create: {
          sku: product.sku,
          slug: product.slug,
          name: product.name,
          descriptionFr: product.descriptionFr,
          descriptionEn: product.descriptionEn,
          price: numericPrice,
          stockQuantity: product.stockQuantity ?? 0,
          isActive: product.isActive ?? true,
          category: {
            connect: { id: categoryId },
          },
          brand: {
            connect: { id: brandId },
          },
        },

        select: { id: true },
      });

      // 5. Images
      await prisma.productImage.deleteMany({
        where: { productId: savedProduct.id },
      });

      const images = (product.images ?? [])
        .filter(
          (image) =>
            typeof image.url === 'string' &&
            image.url.trim() !== '',
        )
        .map((image, imageIndex) => ({
          productId: savedProduct.id,
          url: image.url,
          altText: image.altText ?? product.name,
          position: image.position ?? imageIndex,
          isPrimary: image.isPrimary ?? imageIndex === 0,
        }));

      if (images.length > 0) {
        await prisma.productImage.createMany({
          data: images,
        });
      }

      // 6. Caractéristiques techniques
      await prisma.productSpec.deleteMany({
        where: { productId: savedProduct.id },
      });

      const specs = (product.specs ?? []).map((spec) => ({
        productId: savedProduct.id,
        name: spec.name,
        valueText: spec.valueText,
        valueNumber: spec.valueNumber ?? null,
        unit: spec.unit ?? null,
      }));

      if (specs.length > 0) {
        await prisma.productSpec.createMany({
          data: specs,
        });
      }

      if (existingProduct) {
        updated++;
      } else {
        created++;
      }

      if (
        (index + 1) % 100 === 0 ||
        index + 1 === catalogue.products.length
      ) {
        console.log(
          `Progression : ${index + 1}/${catalogue.products.length}` +
            ` | créés : ${created} | mis à jour : ${updated}`,
        );
      }
    }

    // 7. Vérification finale
    const [
      categoryCount,
      brandCount,
      productCount,
      imageCount,
      specCount,
    ] = await Promise.all([
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.count(),
      prisma.productImage.count(),
      prisma.productSpec.count(),
    ]);

    console.log('\n========== IMPORT TERMINÉ ==========');
    console.log(`Produits créés pendant cet import : ${created}`);
    console.log(`Produits mis à jour : ${updated}`);
    console.log(`Total catégories en base : ${categoryCount}`);
    console.log(`Total marques en base : ${brandCount}`);
    console.log(`Total produits en base : ${productCount}`);
    console.log(`Total images en base : ${imageCount}`);
    console.log(`Total caractéristiques en base : ${specCount}`);
    console.log('====================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\nÉCHEC DE L’IMPORTATION :', error);
  process.exitCode = 1;
});
