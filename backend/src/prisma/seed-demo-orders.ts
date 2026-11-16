import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/enums';
import { hashPassword } from '../auth/password';

// Commandes de DÉMONSTRATION pour le tableau de bord : environ 170 commandes réparties sur
// les 120 derniers jours, passées par des clients fictifs (@demo.bytebazaar.test), avec des
// statuts, des paiements et un historique cohérents avec leur ancienneté.
//
// Relançable : les clients de démonstration et leurs commandes sont recréés à chaque fois.
// Le stock réel n'est pas modifié (ces ventes sont fictives).

const DEMO_DOMAIN = '@demo.bytebazaar.test';
const DAYS = 120;
const SHIPPING_FEE = 7;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

// Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes données à chaque exécution
let seed = 20261115;
function rand(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(list: readonly T[]): T =>
  list[Math.floor(rand() * list.length)];
function weighted<T>(entries: readonly [T, number][]): T {
  let roll = rand() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

const CUSTOMERS = [
  ['Yassine', 'Ben Salah'],
  ['Mariem', 'Trabelsi'],
  ['Skander', 'Jaziri'],
  ['Ines', 'Gharbi'],
  ['Amine', 'Bouazizi'],
  ['Nour', 'Hammami'],
  ['Mehdi', 'Chaabane'],
  ['Sarra', 'Mejri'],
  ['Oussama', 'Ayari'],
  ['Rania', 'Khelifi'],
  ['Firas', 'Dridi'],
  ['Emna', 'Sassi'],
  ['Wassim', 'Karoui'],
  ['Yosra', 'Zouari'],
  ['Hamza', 'Masmoudi'],
  ['Asma', 'Belhadj'],
] as const;

const CITIES = [
  ['Tunis', 'Tunis', '1002'],
  ['La Marsa', 'Tunis', '2070'],
  ['Ariana', 'Ariana', '2080'],
  ['Ben Arous', 'Ben Arous', '2013'],
  ['Sousse', 'Sousse', '4000'],
  ['Sfax', 'Sfax', '3000'],
  ['Monastir', 'Monastir', '5000'],
  ['Nabeul', 'Nabeul', '8000'],
  ['Bizerte', 'Bizerte', '7000'],
  ['Gabès', 'Gabès', '6000'],
] as const;

const STREETS = [
  'Rue de Marseille',
  'Avenue Habib Bourguiba',
  'Rue Ibn Khaldoun',
  'Avenue de la Liberté',
  'Rue du Lac Léman',
  'Avenue Hédi Chaker',
  'Rue Farhat Hached',
] as const;

const PAYMENTS: [PaymentMethod, number][] = [
  ['CASH_ON_DELIVERY', 45],
  ['CARD', 30],
  ['BANK_TRANSFER', 15],
  ['PAYPAL', 10],
];

/** Statut atteint par une commande passée il y a `ageDays` jours */
function statusForAge(ageDays: number): OrderStatus {
  if (rand() < 0.06 && ageDays > 0.5) return 'CANCELLED';
  if (ageDays > 9) return 'DELIVERED';
  if (ageDays > 5)
    return weighted([
      ['DELIVERED', 2],
      ['SHIPPED', 1],
    ]);
  if (ageDays > 2)
    return weighted([
      ['SHIPPED', 2],
      ['PREPARING', 1],
    ]);
  if (ageDays > 0.7)
    return weighted([
      ['PREPARING', 1],
      ['CONFIRMED', 2],
    ]);
  return weighted([
    ['PENDING', 3],
    ['CONFIRMED', 1],
  ]);
}

const PROGRESSION: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
];

/** Dates de passage par chaque statut, jusqu'au statut final */
function timeline(createdAt: Date, status: OrderStatus, now: number) {
  const steps =
    status === 'CANCELLED'
      ? PROGRESSION.slice(0, 1 + Math.floor(rand() * 2))
      : PROGRESSION.slice(0, PROGRESSION.indexOf(status) + 1);
  const events: { status: OrderStatus; createdAt: Date }[] = [];
  let at = createdAt.getTime();
  for (const step of steps) {
    events.push({ status: step, createdAt: new Date(at) });
    // Délais typiques : validation en quelques heures, préparation, puis 1 à 3 jours de transport
    const delay =
      step === 'PENDING'
        ? 1 + rand() * 6
        : step === 'CONFIRMED'
          ? 4 + rand() * 18
          : step === 'PREPARING'
            ? 6 + rand() * 20
            : 20 + rand() * 50;
    at = Math.min(at + delay * HOUR, now - HOUR);
  }
  if (status === 'CANCELLED')
    events.push({
      status: 'CANCELLED',
      createdAt: new Date(Math.min(at, now - HOUR)),
    });
  return events;
}

function paymentStatus(
  method: PaymentMethod,
  status: OrderStatus,
  reached: Set<OrderStatus>,
): PaymentStatus {
  const online = method === 'CARD' || method === 'PAYPAL';
  if (status === 'CANCELLED') return online ? 'REFUNDED' : 'PENDING';
  if (online || status === 'DELIVERED') return 'PAID';
  // Virement : reçu avant l'expédition
  if (method === 'BANK_TRANSFER' && reached.has('PREPARING')) return 'PAID';
  return 'PENDING';
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL est absent du fichier .env.');

  const now = Date.now();
  const products = await prisma.product.findMany({
    where: { isActive: true, stockQuantity: { gt: 0 } },
    orderBy: { popularity: 'desc' },
    take: 400,
    select: {
      id: true,
      name: true,
      price: true,
      category: { select: { slug: true } },
    },
  });
  if (products.length < 20)
    throw new Error(
      'Catalogue vide : lancer « npm run seed » puis « npm run seed:stock ».',
    );

  // 1. Suppression des données de démonstration précédentes
  const previous = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true },
  });
  const previousIds = previous.map((u) => u.id);
  await prisma.$transaction([
    prisma.order.deleteMany({ where: { userId: { in: previousIds } } }),
    prisma.user.deleteMany({ where: { id: { in: previousIds } } }),
  ]);

  // 2. Clients fictifs, inscrits au fil de la période (mot de passe aléatoire : aucun accès)
  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  const customers = [];
  for (const [i, [firstName, lastName]] of CUSTOMERS.entries()) {
    const [city, governorate, postalCode] = pick(CITIES);
    const slug = `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '');
    const user = await prisma.user.create({
      data: {
        email: `${slug}${DEMO_DOMAIN}`,
        passwordHash,
        firstName,
        lastName,
        phone: `${pick(['20', '22', '25', '50', '55', '98'])} ${100 + Math.floor(rand() * 900)} ${100 + Math.floor(rand() * 900)}`,
        createdAt: new Date(now - (DAYS + 10 - i * 8) * DAY),
      },
    });
    customers.push({
      user,
      address: `${1 + Math.floor(rand() * 120)} ${pick(STREETS)}, ${city}, ${governorate} ${postalCode}`,
    });
  }

  // 3. Commandes : activité croissante sur la période, plus forte en fin de semaine
  const references = new Set<string>();
  let created = 0;
  for (let day = DAYS; day >= 0; day--) {
    const date = new Date(now - day * DAY);
    const weekday = date.getDay();
    const trend = 0.9 + (1 - day / DAYS) * 1.1;
    const weekend = weekday === 5 || weekday === 6 ? 1.5 : 1;
    const expected = trend * weekend;
    const count = Math.floor(expected + rand() * 1.2);

    for (let n = 0; n < count; n++) {
      const createdAt = new Date(
        Math.min(
          now - 20 * 60_000,
          now - day * DAY - Math.floor(rand() * 14 * HOUR),
        ),
      );
      const ageDays = (now - createdAt.getTime()) / DAY;
      const customer = pick(customers);
      const status = statusForAge(ageDays);
      const events = timeline(createdAt, status, now);
      const reached = new Set(events.map((e) => e.status));
      const method = weighted(PAYMENTS);
      const payStatus = paymentStatus(method, status, reached);

      const lines = new Map<
        number,
        { product: (typeof products)[number]; quantity: number }
      >();
      const lineCount = weighted([
        [1, 5],
        [2, 3],
        [3, 2],
        [4, 1],
      ] as [number, number][]);
      while (lines.size < lineCount) {
        // Les produits les plus populaires sont plus souvent commandés
        const product = products[Math.floor(rand() ** 2 * products.length)];
        const multiple = ['memoire-ram', 'stockage'].includes(
          product.category.slug,
        );
        lines.set(product.id, {
          product,
          quantity: multiple && rand() < 0.4 ? 2 : 1,
        });
      }
      const subtotal = [...lines.values()].reduce(
        (sum, l) => sum + Number(l.product.price) * l.quantity,
        0,
      );

      let reference: string;
      do {
        reference = `BB-${createdAt.getTime().toString().slice(-6)}-${Math.floor(
          rand() * 1000,
        )
          .toString()
          .padStart(3, '0')}`;
      } while (references.has(reference));
      references.add(reference);

      const at = (s: OrderStatus) =>
        events.find((e) => e.status === s)?.createdAt ?? null;
      await prisma.order.create({
        data: {
          reference,
          userId: customer.user.id,
          status,
          paymentMethod: method,
          paymentStatus: payStatus,
          subtotal,
          shippingFee: SHIPPING_FEE,
          total: subtotal + SHIPPING_FEE,
          shippingName: `${customer.user.firstName} ${customer.user.lastName}`,
          shippingPhone: customer.user.phone ?? '',
          shippingAddress: customer.address,
          createdAt,
          paidAt:
            payStatus === 'PAID' || payStatus === 'REFUNDED'
              ? method === 'CARD' || method === 'PAYPAL'
                ? createdAt
                : (at('DELIVERED') ?? at('PREPARING'))
              : null,
          shippedAt: at('SHIPPED'),
          deliveredAt: at('DELIVERED'),
          items: {
            create: [...lines.values()].map((l) => ({
              productId: l.product.id,
              productName: l.product.name,
              unitPrice: l.product.price,
              quantity: l.quantity,
            })),
          },
          events: { create: events },
        },
      });
      created++;
    }
  }

  const [orders, revenue] = await Promise.all([
    prisma.order.count({
      where: { user: { email: { endsWith: DEMO_DOMAIN } } },
    }),
    prisma.order.aggregate({
      where: {
        user: { email: { endsWith: DEMO_DOMAIN } },
        status: { not: 'CANCELLED' },
      },
      _sum: { total: true },
    }),
  ]);
  console.log('\n===== COMMANDES DE DÉMONSTRATION =====');
  console.log(`Clients fictifs : ${customers.length} (${DEMO_DOMAIN})`);
  console.log(
    `Commandes créées : ${created} sur ${DAYS} jours (${orders} en base)`,
  );
  console.log(
    `Chiffre d'affaires (hors annulations) : ${Number(revenue._sum.total ?? 0).toFixed(3)} TND`,
  );
  console.log('======================================\n');
}

main()
  .catch((error: unknown) => {
    console.error('\nÉCHEC :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
