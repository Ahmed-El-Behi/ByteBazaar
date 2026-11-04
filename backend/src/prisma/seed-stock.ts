import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// =====================================================================
// Stock de TEST : quantités aléatoires mais REPRODUCTIBLES (calculées à
// partir du SKU : un même produit reçoit toujours le même stock).
//
// Répartition :
//   10 %  rupture de stock (0)
//   15 %  stock faible (1 à 3)
//   55 %  stock normal (4 à 12)
//   20 %  bien approvisionné (13 à 25)
//
// Le script est relançable : il ne touche que les produits à 0 qui n'ont
// encore AUCUN mouvement de stock. Un produit déjà approvisionné ou déjà
// vendu n'est jamais modifié. Chaque stock créé écrit un mouvement RESTOCK.
// =====================================================================

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

// Générateur pseudo-aléatoire déterministe (hash FNV-1a + mulberry32)
function rngFromSku(sku: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < sku.length; i++) {
    hash ^= sku.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Bucket = 'rupture' | 'faible' | 'normal' | 'eleve';

function pickStock(sku: string): { stock: number; bucket: Bucket } {
  const rand = rngFromSku(sku);
  const roll = rand();
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  if (roll < 0.1) return { stock: 0, bucket: 'rupture' };
  if (roll < 0.25) return { stock: between(1, 3), bucket: 'faible' };
  if (roll < 0.8) return { stock: between(4, 12), bucket: 'normal' };
  return { stock: between(13, 25), bucket: 'eleve' };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est absent du fichier .env.');
  }

  const total = await prisma.product.count();
  const candidates = await prisma.product.findMany({
    where: { stockQuantity: 0, stockMovements: { none: {} } },
    select: { id: true, sku: true },
    orderBy: { id: 'asc' },
  });

  console.log('\n===== STOCK DE TEST BYTEBAZAAR =====');
  console.log(`Produits en base : ${total}`);
  console.log(`Produits à approvisionner : ${candidates.length}`);
  console.log(`Déjà approvisionnés ou vendus (ignorés) : ${total - candidates.length}`);

  const buckets: Record<Bucket, number> = { rupture: 0, faible: 0, normal: 0, eleve: 0 };
  let restocked = 0;

  for (const product of candidates) {
    const { stock, bucket } = pickStock(product.sku);
    buckets[bucket]++;
    if (stock === 0) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: {
        stockQuantity: stock,
        stockMovements: {
          create: {
            quantityChange: stock,
            reason: 'RESTOCK',
            note: 'Stock initial (données de test)',
          },
        },
      },
    });
    restocked++;

    if (restocked % 500 === 0) console.log(`Progression : ${restocked} produits approvisionnés`);
  }

  const [inStock, outOfStock, sum] = await Promise.all([
    prisma.product.count({ where: { stockQuantity: { gt: 0 } } }),
    prisma.product.count({ where: { stockQuantity: 0 } }),
    prisma.product.aggregate({ _sum: { stockQuantity: true } }),
  ]);

  console.log('\n========== TERMINÉ ==========');
  console.log(`Approvisionnés : ${restocked}`);
  console.log(
    `Répartition tirée : ${buckets.rupture} ruptures, ${buckets.faible} faibles (1-3), ` +
      `${buckets.normal} normaux (4-12), ${buckets.eleve} élevés (13-25)`,
  );
  console.log(`Total en base : ${inStock} en stock, ${outOfStock} en rupture`);
  console.log(`Unités en stock : ${sum._sum.stockQuantity ?? 0}`);
  console.log('=============================\n');
}

main()
  .catch((error: unknown) => {
    console.error('\nÉCHEC :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());