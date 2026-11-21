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

// Données de DÉMONSTRATION : quelques centaines de clients fictifs (adresses gmail, outlook, hotmail…)
// et leurs commandes depuis le 1er janvier 2024, pour que l'administration ait un historique réaliste
// à gérer (tableau de bord sur 12 mois, recherche, filtres, fiches clients).
//
// Ces clients sont marqués `isDemo` : ils ne peuvent pas se connecter (mot de passe aléatoire) et
// MailService ne leur écrit jamais (leurs adresses, inventées, peuvent appartenir à de vraies personnes).
// Relançable : les données fictives précédentes sont supprimées puis recréées à l'identique.
// Le stock réel n'est pas modifié (ces ventes sont fictives).

const START = new Date('2024-01-01T08:00:00+01:00');
const CUSTOMER_COUNT = 1200;
const LEGACY_DOMAIN = '@demo.bytebazaar.test'; // anciennes données de démonstration
const SHIPPING_FEE = 7;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

// Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes données à chaque exécution
let seed = 20240101;
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
/** Tirage de Poisson (nombre de commandes d'une journée) */
function poisson(mean: number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rand();
  while (p > limit) {
    k++;
    p *= rand();
  }
  return k;
}

const MEN = [
  'Mohamed',
  'Ahmed',
  'Youssef',
  'Yassine',
  'Amine',
  'Mehdi',
  'Hamza',
  'Oussama',
  'Firas',
  'Skander',
  'Wassim',
  'Aziz',
  'Karim',
  'Sami',
  'Nizar',
  'Bilel',
  'Hichem',
  'Anis',
  'Walid',
  'Khalil',
  'Marwen',
  'Seif',
  'Fares',
  'Iheb',
  'Rayen',
  'Ghassen',
  'Malek',
  'Omar',
  'Zied',
  'Achraf',
  'Houssem',
  'Ayoub',
  'Adem',
  'Elyes',
  'Slim',
  'Tarek',
  'Nabil',
  'Riadh',
  'Hatem',
  'Moez',
  'Chedly',
  'Aymen',
  'Mootez',
  'Taha',
  'Wael',
] as const;
const WOMEN = [
  'Mariem',
  'Ines',
  'Nour',
  'Sarra',
  'Rania',
  'Emna',
  'Yosra',
  'Asma',
  'Amira',
  'Fatma',
  'Salma',
  'Rim',
  'Hiba',
  'Eya',
  'Molka',
  'Chaima',
  'Nesrine',
  'Olfa',
  'Sonia',
  'Imen',
  'Khouloud',
  'Wiem',
  'Rahma',
  'Syrine',
  'Takwa',
  'Ons',
  'Lina',
  'Meriem',
  'Dorra',
  'Farah',
  'Hana',
  'Jihen',
  'Manel',
  'Nadia',
  'Sihem',
  'Yasmine',
  'Zeineb',
  'Arij',
  'Cyrine',
  'Ghada',
] as const;
const LAST_NAMES = [
  'Ben Salah',
  'Trabelsi',
  'Jaziri',
  'Gharbi',
  'Bouazizi',
  'Hammami',
  'Chaabane',
  'Mejri',
  'Ayari',
  'Khelifi',
  'Dridi',
  'Sassi',
  'Karoui',
  'Zouari',
  'Masmoudi',
  'Belhadj',
  'Ben Ali',
  'Jebali',
  'Mansouri',
  'Ferchichi',
  'Haddad',
  'Riahi',
  'Baccouche',
  'Ben Amor',
  'Saidi',
  'Hamdi',
  'Ghannouchi',
  'Kefi',
  'Tlili',
  'Mabrouk',
  'Chebbi',
  'Jendoubi',
  'Mzoughi',
  'Ouerghi',
  'Toumi',
  'Bouaziz',
  'Ben Youssef',
  'Lahmar',
  'Snoussi',
  'Abidi',
  'Mathlouthi',
  'Kammoun',
  'Ellouze',
  'Fourati',
  'Charfi',
  'Sellami',
  'Turki',
  'Ben Romdhane',
  'Nasri',
  'Amri',
  'Hajji',
  'Bouslama',
  'Mokni',
  'Rekik',
  'Guesmi',
  'Chouchane',
  'Bahri',
  'Ksouri',
  'Mestiri',
  'Zaier',
  'Ben Hassine',
  'Rebai',
  'Daoud',
  'Laabidi',
  'Hamrouni',
  'Barhoumi',
  'Ben Mabrouk',
  'Ghorbel',
  'Kchaou',
  'Bellalah',
] as const;

const EMAIL_DOMAINS: [string, number][] = [
  ['gmail.com', 46],
  ['outlook.com', 15],
  ['hotmail.com', 13],
  ['yahoo.fr', 9],
  ['topnet.tn', 7],
  ['gnet.tn', 4],
  ['icloud.com', 4],
  ['live.fr', 2],
];

// Ville, gouvernorat, code postal ; poids ≈ population
const CITIES: [[string, string, string], number][] = [
  [['Tunis', 'Tunis', '1000'], 14],
  [['La Marsa', 'Tunis', '2070'], 4],
  [['Le Bardo', 'Tunis', '2000'], 3],
  [['Ariana', 'Ariana', '2080'], 7],
  [['Ennasr', 'Ariana', '2037'], 4],
  [['Ben Arous', 'Ben Arous', '2013'], 5],
  [['Ezzahra', 'Ben Arous', '2034'], 2],
  [['La Manouba', 'Manouba', '2010'], 3],
  [['Sousse', 'Sousse', '4000'], 8],
  [['Hammam Sousse', 'Sousse', '4011'], 2],
  [['Sfax', 'Sfax', '3000'], 9],
  [['Monastir', 'Monastir', '5000'], 4],
  [['Mahdia', 'Mahdia', '5100'], 2],
  [['Nabeul', 'Nabeul', '8000'], 3],
  [['Hammamet', 'Nabeul', '8050'], 2],
  [['Bizerte', 'Bizerte', '7000'], 3],
  [['Kairouan', 'Kairouan', '3100'], 2],
  [['Gabès', 'Gabès', '6000'], 2],
  [['Médenine', 'Médenine', '4100'], 1],
  [['Djerba Houmt Souk', 'Médenine', '4180'], 1],
  [['Gafsa', 'Gafsa', '2100'], 1],
  [['Béja', 'Béja', '9000'], 1],
  [['Jendouba', 'Jendouba', '8100'], 1],
  [['Le Kef', 'Le Kef', '7100'], 1],
  [['Kasserine', 'Kasserine', '1200'], 1],
  [['Sidi Bouzid', 'Sidi Bouzid', '9100'], 1],
  [['Zaghouan', 'Zaghouan', '1100'], 1],
  [['Tozeur', 'Tozeur', '2200'], 1],
];

const STREETS = [
  'Rue de Marseille',
  'Avenue Habib Bourguiba',
  'Rue Ibn Khaldoun',
  'Avenue de la Liberté',
  'Rue du Lac Léman',
  'Avenue Hédi Chaker',
  'Rue Farhat Hached',
  'Avenue de Carthage',
  'Rue de Palestine',
  'Avenue Mohamed V',
  'Rue Alain Savary',
  'Avenue de France',
  'Rue Ali Belhouane',
  'Avenue Taïeb Mhiri',
  'Rue de Rome',
  'Rue Mongi Slim',
  'Avenue Abdelaziz Thaalbi',
  'Rue Hannibal',
  'Avenue de l’Environnement',
  'Rue Ibn Sina',
] as const;

const PHONE_PREFIXES = [
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '50',
  '52',
  '53',
  '54',
  '55',
  '56',
  '58',
  '92',
  '93',
  '94',
  '95',
  '96',
  '97',
  '98',
  '99',
  '40',
  '41',
  '42',
  '44',
  '46',
] as const;

const PAYMENTS: [PaymentMethod, number][] = [
  ['CASH_ON_DELIVERY', 45],
  ['CARD', 30],
  ['BANK_TRANSFER', 15],
  ['PAYPAL', 10],
];

// Ramadan (activité en baisse) puis semaine de l'Aïd (reprise)
const RAMADAN: [string, string][] = [
  ['2024-03-11', '2024-04-09'],
  ['2025-03-01', '2025-03-30'],
  ['2026-02-18', '2026-03-19'],
];
// Fréquentation relative par mois (rentrée, Black Friday, fin d'année plus forts)
const MONTH = [0.9, 0.85, 0.95, 1, 1, 0.95, 1.05, 1.1, 1.3, 1.1, 1.35, 1.3];

function seasonFactor(date: Date): number {
  let f = MONTH[date.getMonth()];
  const day = date.getDay();
  if (day === 0 || day === 6) f *= 1.25;
  const iso = date.toISOString().slice(0, 10);
  for (const [from, to] of RAMADAN) {
    if (iso >= from && iso <= to) f *= 0.75;
    const end = new Date(to).getTime();
    if (date.getTime() > end && date.getTime() <= end + 7 * DAY) f *= 1.35;
  }
  // Semaine du Black Friday (dernier vendredi de novembre)
  if (date.getMonth() === 10) {
    const last = new Date(date.getFullYear(), 11, 0);
    const blackFriday = last.getDate() - ((last.getDay() + 2) % 7);
    if (Math.abs(date.getDate() - blackFriday) <= 3) f *= 2.2;
  }
  return f;
}

/** Retire accents, espaces et apostrophes : « Ben Ali » -> « benali » */
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s'’-]/g, '')
    .toLowerCase();

function emailFor(first: string, last: string, taken: Set<string>): string {
  const f = plain(first);
  const l = plain(last);
  const year = String(84 + Math.floor(rand() * 23))
    .slice(-2)
    .padStart(2, '0');
  for (;;) {
    const local = weighted<string>([
      [`${f}.${l}`, 30],
      [`${f}${l}`, 12],
      [`${f}.${l}${year}`, 12],
      [`${f[0]}${l}`, 8],
      [`${f}_${l}`, 6],
      [`${l}.${f}`, 6],
      [`${f}${l}${Math.floor(rand() * 900 + 100)}`, 10],
      [`${f}.${l}${Math.floor(rand() * 90 + 10)}`, 10],
      [`${f}${year}`, 6],
    ]);
    const email = `${local}@${weighted(EMAIL_DOMAINS)}`;
    if (!taken.has(email)) {
      taken.add(email);
      return email;
    }
  }
}

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
  const span = now - START.getTime();
  const products = await prisma.product.findMany({
    where: { isActive: true, stockQuantity: { gt: 0 } },
    orderBy: { popularity: 'desc' },
    take: 800,
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

  // 1. Suppression des données fictives précédentes (et des anciennes @demo.bytebazaar.test)
  const previous = await prisma.user.findMany({
    where: {
      OR: [{ isDemo: true }, { email: { endsWith: LEGACY_DOMAIN } }],
    },
    select: { id: true },
  });
  const previousIds = previous.map((u) => u.id);
  await prisma.$transaction([
    prisma.order.deleteMany({ where: { userId: { in: previousIds } } }),
    prisma.user.deleteMany({ where: { id: { in: previousIds } } }),
  ]);

  // 2. Clients fictifs, inscrits de fin 2023 à aujourd'hui (plus nombreux récemment)
  const taken = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u) =>
      u.email.toLowerCase(),
    ),
  );
  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  const drafts = Array.from({ length: CUSTOMER_COUNT }, () => {
    const woman = rand() < 0.42;
    const firstName = pick(woman ? WOMEN : MEN);
    const lastName = pick(LAST_NAMES);
    const registered =
      START.getTime() - 40 * DAY + (span + 40 * DAY) * rand() ** 0.85;
    // Fidélité : quelques clients commandent souvent, la plupart rarement
    const loyalty = Math.min(5, (1 / (1 - rand() * 0.95)) ** 0.6);
    return { firstName, lastName, registered, loyalty };
  }).sort((a, b) => a.registered - b.registered);

  const customers: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    registered: number;
    loyalty: number;
    activeUntil: number;
  }[] = [];
  for (const d of drafts) {
    const [city, governorate, postalCode] = weighted(CITIES);
    const phone = `${pick(PHONE_PREFIXES)} ${100 + Math.floor(rand() * 900)} ${100 + Math.floor(rand() * 900)}`;
    const street = `${1 + Math.floor(rand() * 140)} ${pick(STREETS)}`;
    const work = rand() < 0.22 ? weighted(CITIES) : null;
    const user = await prisma.user.create({
      data: {
        email: emailFor(d.firstName, d.lastName, taken),
        passwordHash,
        firstName: d.firstName,
        lastName: d.lastName,
        phone,
        isDemo: true,
        language: rand() < 0.1 ? 'EN' : 'FR',
        createdAt: new Date(d.registered),
        addresses: {
          create: [
            {
              label: 'Domicile',
              recipientName: `${d.firstName} ${d.lastName}`,
              phone,
              street,
              city,
              governorate,
              postalCode,
              isDefault: true,
            },
            ...(work
              ? [
                  {
                    label: 'Travail',
                    recipientName: `${d.firstName} ${d.lastName}`,
                    phone,
                    street: `${1 + Math.floor(rand() * 90)} ${pick(STREETS)}`,
                    city: work[0],
                    governorate: work[1],
                    postalCode: work[2],
                  },
                ]
              : []),
          ],
        },
      },
    });
    customers.push({
      id: user.id,
      firstName: d.firstName,
      lastName: d.lastName,
      phone,
      address: `${street}, ${city}, ${governorate} ${postalCode}`,
      registered: d.registered,
      loyalty: d.loyalty,
      // Période d'activité : d'un mois à environ deux ans, puis le client ne commande plus
      activeUntil: d.registered + (30 + 720 * rand() ** 1.3) * DAY,
    });
  }
  /** Un client inscrit et encore actif à cette date, tiré proportionnellement à sa fidélité */
  function customerAt(time: number) {
    const active = customers.filter(
      (c) => c.registered <= time && time <= c.activeUntil,
    );
    if (!active.length) return null;
    let roll = rand() * active.reduce((sum, c) => sum + c.loyalty, 0);
    for (const c of active) {
      roll -= c.loyalty;
      if (roll <= 0) return c;
    }
    return active[active.length - 1];
  }

  // 3. Commandes jour par jour : activité croissante, saisons, week-ends
  const references = new Set(
    (await prisma.order.findMany({ select: { reference: true } })).map(
      (o) => o.reference,
    ),
  );
  const pending: Promise<unknown>[] = [];
  const perYear = new Map<number, number>();
  let created = 0;
  for (let dayStart = START.getTime(); dayStart < now; dayStart += DAY) {
    const progress = (dayStart - START.getTime()) / span;
    const date = new Date(dayStart);
    const expected = (1.1 + 4.2 * progress ** 1.25) * seasonFactor(date);
    const count = poisson(expected);

    for (let n = 0; n < count; n++) {
      // Heure de la commande : surtout l'après-midi et le soir
      const createdAt = new Date(
        Math.min(now - 20 * 60_000, dayStart + (1 + 15 * rand() ** 0.7) * HOUR),
      );
      const customer = customerAt(createdAt.getTime());
      if (!customer) continue;
      const ageDays = (now - createdAt.getTime()) / DAY;
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
      pending.push(
        prisma.order.create({
          data: {
            reference,
            userId: customer.id,
            status,
            paymentMethod: method,
            paymentStatus: payStatus,
            subtotal,
            shippingFee: SHIPPING_FEE,
            total: subtotal + SHIPPING_FEE,
            shippingName: `${customer.firstName} ${customer.lastName}`,
            shippingPhone: customer.phone,
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
        }),
      );
      // Écritures par lots de 25 en parallèle
      if (pending.length >= 25) await Promise.all(pending.splice(0));
      const year = createdAt.getFullYear();
      perYear.set(year, (perYear.get(year) ?? 0) + 1);
      created++;
    }
  }
  await Promise.all(pending);

  const [orders, revenue, buyers] = await Promise.all([
    prisma.order.count({ where: { user: { isDemo: true } } }),
    prisma.order.aggregate({
      where: { user: { isDemo: true }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.user.count({ where: { isDemo: true, orders: { some: {} } } }),
  ]);
  console.log('\n===== DONNÉES DE DÉMONSTRATION =====');
  console.log(
    `Clients fictifs : ${customers.length} (dont ${buyers} avec au moins une commande ; aucun e-mail ne leur est envoyé)`,
  );
  console.log(
    `Commandes créées : ${created} depuis le ${START.toLocaleDateString('fr-FR')} (${orders} en base)`,
  );
  for (const [year, count] of [...perYear].sort(([a], [b]) => a - b))
    console.log(`  ${year} : ${count} commandes`);
  console.log(
    `Chiffre d'affaires (hors annulations) : ${Number(revenue._sum.total ?? 0).toFixed(3)} TND`,
  );
  console.log('====================================\n');
}

main()
  .catch((error: unknown) => {
    console.error('\nÉCHEC :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
