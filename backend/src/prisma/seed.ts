import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// =====================================================================
// Donnees de TEST : prix et caracteristiques approximatifs, a verifier
// et a remplacer par le vrai catalogue avant la mise en ligne.
// Le script est relancable : il ignore ce qui existe deja.
// =====================================================================

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

type FormFactor = 'ATX' | 'MICRO_ATX' | 'MINI_ITX' | 'E_ATX';
type RamType = 'DDR4' | 'DDR5';
type Spec = { name: string; valueText: string; valueNumber?: number; unit?: string };

type ProductDef = {
  sku: string;
  slug: string;
  name: string;
  brand: string; // slug de la marque
  category: string; // slug de la categorie
  price: number; // en TND
  stock: number;
  fr: string;
  en: string;
  cpu?: {
    socket: string;
    cores: number;
    threads: number;
    baseClockGHz: number;
    boostClockGHz?: number;
    tdpWatts: number;
    hasIntegratedGraphics: boolean;
  };
  motherboard?: {
    socket: string;
    chipset: string;
    formFactor: FormFactor;
    ramType: RamType;
    ramSlots: number;
    maxRamGB: number;
  };
  ram?: { type: RamType; capacityGB: number; modules: number; speedMHz: number };
  gpu?: {
    chipset: string;
    vramGB: number;
    tdpWatts: number;
    lengthMm: number;
    recommendedPsuWatts?: number;
  };
  powerSupply?: { wattage: number; efficiency: string; isModular: boolean };
  pcCase?: { supportedFormFactors: FormFactor[]; maxGpuLengthMm: number };
  specs?: Spec[];
};

// ---------------------------------------------------------------- Categories
const rootCategories = [
  { slug: 'composants', nameFr: 'Composants PC', nameEn: 'PC components', sortOrder: 1 },
  { slug: 'peripheriques', nameFr: 'Périphériques', nameEn: 'Peripherals', sortOrder: 2 },
];

const childCategories = [
  { slug: 'processeurs', parent: 'composants', nameFr: 'Processeurs', nameEn: 'Processors', sortOrder: 1 },
  { slug: 'cartes-meres', parent: 'composants', nameFr: 'Cartes mères', nameEn: 'Motherboards', sortOrder: 2 },
  { slug: 'memoire-ram', parent: 'composants', nameFr: 'Mémoire RAM', nameEn: 'Memory (RAM)', sortOrder: 3 },
  { slug: 'cartes-graphiques', parent: 'composants', nameFr: 'Cartes graphiques', nameEn: 'Graphics cards', sortOrder: 4 },
  { slug: 'alimentations', parent: 'composants', nameFr: 'Alimentations', nameEn: 'Power supplies', sortOrder: 5 },
  { slug: 'boitiers', parent: 'composants', nameFr: 'Boîtiers', nameEn: 'PC cases', sortOrder: 6 },
  { slug: 'souris', parent: 'peripheriques', nameFr: 'Souris', nameEn: 'Mice', sortOrder: 1 },
  { slug: 'claviers', parent: 'peripheriques', nameFr: 'Claviers', nameEn: 'Keyboards', sortOrder: 2 },
  { slug: 'ecrans', parent: 'peripheriques', nameFr: 'Écrans', nameEn: 'Monitors', sortOrder: 3 },
];

// -------------------------------------------------------------------- Marques
const brands = [
  { slug: 'amd', name: 'AMD' },
  { slug: 'intel', name: 'Intel' },
  { slug: 'asus', name: 'ASUS' },
  { slug: 'gigabyte', name: 'Gigabyte' },
  { slug: 'msi', name: 'MSI' },
  { slug: 'corsair', name: 'Corsair' },
  { slug: 'kingston', name: 'Kingston' },
  { slug: 'gskill', name: 'G.Skill' },
  { slug: 'sapphire', name: 'Sapphire' },
  { slug: 'nzxt', name: 'NZXT' },
  { slug: 'cooler-master', name: 'Cooler Master' },
  { slug: 'logitech', name: 'Logitech' },
  { slug: 'redragon', name: 'Redragon' },
  { slug: 'aoc', name: 'AOC' },
];

// -------------------------------------------------------------------- Produits
const products: ProductDef[] = [
  // ---- Processeurs
  {
    sku: 'CPU-AMD-R5-7600', slug: 'amd-ryzen-5-7600', name: 'AMD Ryzen 5 7600',
    brand: 'amd', category: 'processeurs', price: 849, stock: 15,
    fr: 'Processeur 6 cœurs AM5 avec graphique intégré, idéal pour le jeu en 1080p.',
    en: '6-core AM5 processor with integrated graphics, ideal for 1080p gaming.',
    cpu: { socket: 'AM5', cores: 6, threads: 12, baseClockGHz: 3.8, boostClockGHz: 5.1, tdpWatts: 65, hasIntegratedGraphics: true },
  },
  {
    sku: 'CPU-AMD-R7-7700X', slug: 'amd-ryzen-7-7700x', name: 'AMD Ryzen 7 7700X',
    brand: 'amd', category: 'processeurs', price: 1150, stock: 10,
    fr: 'Processeur 8 cœurs AM5 très rapide, pour le jeu et la création de contenu.',
    en: 'Fast 8-core AM5 processor for gaming and content creation.',
    cpu: { socket: 'AM5', cores: 8, threads: 16, baseClockGHz: 4.5, boostClockGHz: 5.4, tdpWatts: 105, hasIntegratedGraphics: true },
  },
  {
    sku: 'CPU-INT-I5-13400F', slug: 'intel-core-i5-13400f', name: 'Intel Core i5-13400F',
    brand: 'intel', category: 'processeurs', price: 729, stock: 20,
    fr: 'Processeur 10 cœurs LGA1700, excellent rapport qualité/prix. Sans graphique intégré.',
    en: '10-core LGA1700 processor with great value. No integrated graphics.',
    cpu: { socket: 'LGA1700', cores: 10, threads: 16, baseClockGHz: 2.5, boostClockGHz: 4.6, tdpWatts: 65, hasIntegratedGraphics: false },
  },
  {
    sku: 'CPU-INT-I7-13700K', slug: 'intel-core-i7-13700k', name: 'Intel Core i7-13700K',
    brand: 'intel', category: 'processeurs', price: 1590, stock: 6,
    fr: 'Processeur 16 cœurs LGA1700 débloqué, pour les configurations haut de gamme.',
    en: 'Unlocked 16-core LGA1700 processor for high-end builds.',
    cpu: { socket: 'LGA1700', cores: 16, threads: 24, baseClockGHz: 3.4, boostClockGHz: 5.4, tdpWatts: 125, hasIntegratedGraphics: true },
  },

  // ---- Cartes meres
  {
    sku: 'MB-ASUS-B650-TUF', slug: 'asus-tuf-gaming-b650-plus-wifi', name: 'ASUS TUF Gaming B650-Plus WiFi',
    brand: 'asus', category: 'cartes-meres', price: 890, stock: 8,
    fr: 'Carte mère ATX AM5 DDR5 avec WiFi, robuste et complète.',
    en: 'ATX AM5 DDR5 motherboard with WiFi, sturdy and well-equipped.',
    motherboard: { socket: 'AM5', chipset: 'B650', formFactor: 'ATX', ramType: 'DDR5', ramSlots: 4, maxRamGB: 192 },
  },
  {
    sku: 'MB-GIG-B650M-DS3H', slug: 'gigabyte-b650m-ds3h', name: 'Gigabyte B650M DS3H',
    brand: 'gigabyte', category: 'cartes-meres', price: 620, stock: 12,
    fr: 'Carte mère micro-ATX AM5 DDR5 abordable, parfaite pour un PC compact.',
    en: 'Affordable micro-ATX AM5 DDR5 motherboard, great for a compact PC.',
    motherboard: { socket: 'AM5', chipset: 'B650', formFactor: 'MICRO_ATX', ramType: 'DDR5', ramSlots: 4, maxRamGB: 192 },
  },
  {
    sku: 'MB-MSI-B760M-P-D4', slug: 'msi-pro-b760m-p-ddr4', name: 'MSI PRO B760M-P DDR4',
    brand: 'msi', category: 'cartes-meres', price: 439, stock: 14,
    fr: 'Carte mère micro-ATX LGA1700 DDR4, idéale pour les petits budgets.',
    en: 'Micro-ATX LGA1700 DDR4 motherboard, ideal for tight budgets.',
    motherboard: { socket: 'LGA1700', chipset: 'B760', formFactor: 'MICRO_ATX', ramType: 'DDR4', ramSlots: 2, maxRamGB: 64 },
  },
  {
    sku: 'MB-ASUS-Z790-P', slug: 'asus-prime-z790-p-wifi', name: 'ASUS Prime Z790-P WiFi',
    brand: 'asus', category: 'cartes-meres', price: 1049, stock: 5,
    fr: 'Carte mère ATX LGA1700 DDR5 avec WiFi, compatible overclocking.',
    en: 'ATX LGA1700 DDR5 motherboard with WiFi, overclocking-ready.',
    motherboard: { socket: 'LGA1700', chipset: 'Z790', formFactor: 'ATX', ramType: 'DDR5', ramSlots: 4, maxRamGB: 192 },
  },

  // ---- Memoire RAM
  {
    sku: 'RAM-COR-LPX-16-3200', slug: 'corsair-vengeance-lpx-16go-ddr4-3200', name: 'Corsair Vengeance LPX 16 Go (2x8) DDR4-3200',
    brand: 'corsair', category: 'memoire-ram', price: 139, stock: 30,
    fr: 'Kit mémoire DDR4 16 Go (2 x 8 Go) à 3200 MHz.',
    en: '16 GB (2 x 8 GB) DDR4 memory kit at 3200 MHz.',
    ram: { type: 'DDR4', capacityGB: 16, modules: 2, speedMHz: 3200 },
  },
  {
    sku: 'RAM-KIN-FB-32-3200', slug: 'kingston-fury-beast-32go-ddr4-3200', name: 'Kingston FURY Beast 32 Go (2x16) DDR4-3200',
    brand: 'kingston', category: 'memoire-ram', price: 249, stock: 18,
    fr: 'Kit mémoire DDR4 32 Go (2 x 16 Go) à 3200 MHz.',
    en: '32 GB (2 x 16 GB) DDR4 memory kit at 3200 MHz.',
    ram: { type: 'DDR4', capacityGB: 32, modules: 2, speedMHz: 3200 },
  },
  {
    sku: 'RAM-COR-VEN-32-5600', slug: 'corsair-vengeance-32go-ddr5-5600', name: 'Corsair Vengeance 32 Go (2x16) DDR5-5600',
    brand: 'corsair', category: 'memoire-ram', price: 420, stock: 16,
    fr: 'Kit mémoire DDR5 32 Go (2 x 16 Go) à 5600 MHz.',
    en: '32 GB (2 x 16 GB) DDR5 memory kit at 5600 MHz.',
    ram: { type: 'DDR5', capacityGB: 32, modules: 2, speedMHz: 5600 },
  },
  {
    sku: 'RAM-GSK-TZ5-32-6000', slug: 'gskill-trident-z5-rgb-32go-ddr5-6000', name: 'G.Skill Trident Z5 RGB 32 Go (2x16) DDR5-6000',
    brand: 'gskill', category: 'memoire-ram', price: 539, stock: 9,
    fr: 'Kit mémoire DDR5 32 Go rapide avec éclairage RGB, 6000 MHz.',
    en: 'Fast 32 GB DDR5 kit with RGB lighting, 6000 MHz.',
    ram: { type: 'DDR5', capacityGB: 32, modules: 2, speedMHz: 6000 },
  },

  // ---- Cartes graphiques
  {
    sku: 'GPU-ASUS-RTX4060-DUAL', slug: 'asus-dual-geforce-rtx-4060-oc-8go', name: 'ASUS Dual GeForce RTX 4060 OC 8 Go',
    brand: 'asus', category: 'cartes-graphiques', price: 1349, stock: 10,
    fr: 'Carte graphique NVIDIA pour jouer en 1080p avec une faible consommation.',
    en: 'NVIDIA graphics card for 1080p gaming with low power consumption.',
    gpu: { chipset: 'NVIDIA GeForce RTX 4060', vramGB: 8, tdpWatts: 115, lengthMm: 227, recommendedPsuWatts: 550 },
  },
  {
    sku: 'GPU-SAP-RX7600-PULSE', slug: 'sapphire-pulse-radeon-rx-7600-8go', name: 'Sapphire Pulse Radeon RX 7600 8 Go',
    brand: 'sapphire', category: 'cartes-graphiques', price: 1099, stock: 7,
    fr: 'Carte graphique AMD efficace pour le jeu en 1080p.',
    en: 'Efficient AMD graphics card for 1080p gaming.',
    gpu: { chipset: 'AMD Radeon RX 7600', vramGB: 8, tdpWatts: 165, lengthMm: 240, recommendedPsuWatts: 550 },
  },
  {
    sku: 'GPU-MSI-RTX4070S-V2X', slug: 'msi-geforce-rtx-4070-super-12g-ventus-2x', name: 'MSI GeForce RTX 4070 SUPER 12G Ventus 2X',
    brand: 'msi', category: 'cartes-graphiques', price: 2790, stock: 4,
    fr: 'Carte graphique NVIDIA haut de gamme pour le jeu en 1440p.',
    en: 'High-end NVIDIA graphics card for 1440p gaming.',
    gpu: { chipset: 'NVIDIA GeForce RTX 4070 SUPER', vramGB: 12, tdpWatts: 220, lengthMm: 242, recommendedPsuWatts: 650 },
  },

  // ---- Alimentations
  {
    sku: 'PSU-COR-CX550', slug: 'corsair-cx550', name: 'Corsair CX550',
    brand: 'corsair', category: 'alimentations', price: 199, stock: 20,
    fr: 'Alimentation 550 W certifiée 80 Plus Bronze, pour les configurations simples.',
    en: '550 W 80 Plus Bronze power supply for simple builds.',
    powerSupply: { wattage: 550, efficiency: '80 Plus Bronze', isModular: false },
  },
  {
    sku: 'PSU-MSI-A650BN', slug: 'msi-mag-a650bn', name: 'MSI MAG A650BN',
    brand: 'msi', category: 'alimentations', price: 229, stock: 17,
    fr: 'Alimentation 650 W certifiée 80 Plus Bronze, fiable et économique.',
    en: 'Reliable and affordable 650 W 80 Plus Bronze power supply.',
    powerSupply: { wattage: 650, efficiency: '80 Plus Bronze', isModular: false },
  },
  {
    sku: 'PSU-COR-RM750E', slug: 'corsair-rm750e', name: 'Corsair RM750e',
    brand: 'corsair', category: 'alimentations', price: 419, stock: 8,
    fr: 'Alimentation 750 W 80 Plus Gold entièrement modulaire.',
    en: 'Fully modular 750 W 80 Plus Gold power supply.',
    powerSupply: { wattage: 750, efficiency: '80 Plus Gold', isModular: true },
  },

  // ---- Boitiers
  {
    sku: 'CASE-NZXT-H5FLOW', slug: 'nzxt-h5-flow', name: 'NZXT H5 Flow',
    brand: 'nzxt', category: 'boitiers', price: 369, stock: 6,
    fr: 'Boîtier moyen format ATX avec un excellent flux d’air.',
    en: 'Mid-tower ATX case with excellent airflow.',
    pcCase: { supportedFormFactors: ['ATX', 'MICRO_ATX', 'MINI_ITX'], maxGpuLengthMm: 365 },
  },
  {
    sku: 'CASE-COR-4000D', slug: 'corsair-4000d-airflow', name: 'Corsair 4000D Airflow',
    brand: 'corsair', category: 'boitiers', price: 349, stock: 9,
    fr: 'Boîtier moyen format ATX, montage facile et bonne ventilation.',
    en: 'Mid-tower ATX case with easy building and good cooling.',
    pcCase: { supportedFormFactors: ['ATX', 'MICRO_ATX', 'MINI_ITX'], maxGpuLengthMm: 360 },
  },
  {
    sku: 'CASE-CM-Q300L', slug: 'cooler-master-masterbox-q300l', name: 'Cooler Master MasterBox Q300L',
    brand: 'cooler-master', category: 'boitiers', price: 169, stock: 11,
    fr: 'Boîtier compact micro-ATX, économique et pratique.',
    en: 'Compact and affordable micro-ATX case.',
    pcCase: { supportedFormFactors: ['MICRO_ATX', 'MINI_ITX'], maxGpuLengthMm: 360 },
  },

  // ---- Peripheriques (produits simples, caracteristiques dans ProductSpec)
  {
    sku: 'PER-LOG-G102', slug: 'logitech-g102-lightsync', name: 'Logitech G102 Lightsync',
    brand: 'logitech', category: 'souris', price: 69, stock: 40,
    fr: 'Souris gaming filaire avec capteur 8000 DPI et éclairage RGB.',
    en: 'Wired gaming mouse with 8000 DPI sensor and RGB lighting.',
    specs: [
      { name: 'Connectique', valueText: 'Filaire (USB)' },
      { name: 'Résolution maximale', valueText: '8000 DPI', valueNumber: 8000, unit: 'DPI' },
      { name: 'Boutons', valueText: '6', valueNumber: 6 },
      { name: 'Rétroéclairage', valueText: 'RGB' },
    ],
  },
  {
    sku: 'PER-RED-K552', slug: 'redragon-k552-kumara-rgb', name: 'Redragon K552 Kumara RGB',
    brand: 'redragon', category: 'claviers', price: 129, stock: 25,
    fr: 'Clavier mécanique compact filaire avec rétroéclairage RGB.',
    en: 'Compact wired mechanical keyboard with RGB backlight.',
    specs: [
      { name: 'Format', valueText: 'TKL (87 touches)', valueNumber: 87, unit: 'touches' },
      { name: 'Switches', valueText: 'Outemu Blue' },
      { name: 'Connectique', valueText: 'Filaire (USB)' },
      { name: 'Rétroéclairage', valueText: 'RGB' },
    ],
  },
  {
    sku: 'PER-AOC-24G2SP', slug: 'aoc-24g2sp-165hz', name: 'AOC 24G2SP 24" 165 Hz',
    brand: 'aoc', category: 'ecrans', price: 549, stock: 10,
    fr: 'Écran gaming IPS 23,8 pouces Full HD, 165 Hz et 1 ms.',
    en: '23.8-inch Full HD IPS gaming monitor, 165 Hz and 1 ms.',
    specs: [
      { name: 'Diagonale', valueText: '23,8 pouces', valueNumber: 23.8, unit: 'pouces' },
      { name: 'Résolution', valueText: '1920 x 1080' },
      { name: 'Fréquence', valueText: '165 Hz', valueNumber: 165, unit: 'Hz' },
      { name: 'Type de dalle', valueText: 'IPS' },
      { name: 'Temps de réponse', valueText: '1 ms', valueNumber: 1, unit: 'ms' },
    ],
  },
];

// -------------------------------------------------------------------- Execution
async function main() {
  // Categories (parents d'abord)
  const categoryIds = new Map<string, number>();
  for (const c of rootCategories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, nameFr: c.nameFr, nameEn: c.nameEn, sortOrder: c.sortOrder },
    });
    categoryIds.set(c.slug, row.id);
  }
  for (const c of childCategories) {
    const parentId = categoryIds.get(c.parent);
    if (parentId === undefined) throw new Error(`Categorie parente introuvable : ${c.parent}`);
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, nameFr: c.nameFr, nameEn: c.nameEn, sortOrder: c.sortOrder, parentId },
    });
    categoryIds.set(c.slug, row.id);
  }

  // Marques
  const brandIds = new Map<string, number>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: {},
      create: { slug: b.slug, name: b.name },
    });
    brandIds.set(b.slug, row.id);
  }

  // Produits
  let created = 0;
  let skipped = 0;
  for (const p of products) {
    const categoryId = categoryIds.get(p.category);
    const brandId = brandIds.get(p.brand);
    if (categoryId === undefined) throw new Error(`Categorie introuvable : ${p.category} (${p.sku})`);
    if (brandId === undefined) throw new Error(`Marque introuvable : ${p.brand} (${p.sku})`);

    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        descriptionFr: p.fr,
        descriptionEn: p.en,
        price: p.price,
        stockQuantity: p.stock,
        category: { connect: { id: categoryId } },
        brand: { connect: { id: brandId } },
        ...(p.cpu && { cpu: { create: p.cpu } }),
        ...(p.motherboard && { motherboard: { create: p.motherboard } }),
        ...(p.ram && { ram: { create: p.ram } }),
        ...(p.gpu && { gpu: { create: p.gpu } }),
        ...(p.powerSupply && { powerSupply: { create: p.powerSupply } }),
        ...(p.pcCase && { pcCase: { create: p.pcCase } }),
        ...(p.specs && { specs: { create: p.specs } }),
        stockMovements: {
          create: {
            quantityChange: p.stock,
            reason: 'RESTOCK',
            note: 'Stock initial (données de test)',
          },
        },
      },
    });
    created++;
  }

  const [nCat, nBrand, nProd, nMove] = await Promise.all([
    prisma.category.count(),
    prisma.brand.count(),
    prisma.product.count(),
    prisma.stockMovement.count(),
  ]);
  console.log(`Produits crees : ${created} (ignores car deja presents : ${skipped})`);
  console.log(`Total en base : ${nCat} categories, ${nBrand} marques, ${nProd} produits, ${nMove} mouvements de stock`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());