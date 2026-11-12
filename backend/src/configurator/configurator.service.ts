import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { asRecord, badRequest, int, text } from '../common/input';
import {
  FORM_FACTOR_LABELS,
  SLOTS,
  SLOT_CATEGORY,
  evaluate,
  fits,
  type Build,
  type BuildPart,
  type Slot,
} from './compatibility';

const MAX_CONFIGURATIONS_PER_USER = 50;

const PART_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  stockQuantity: true,
  brand: { select: { name: true } },
  category: { select: { slug: true } },
  images: {
    select: { url: true, altText: true },
    orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
    take: 1,
  },
  specs: { select: { name: true, valueText: true } },
  cpu: {
    select: {
      socket: true,
      cores: true,
      tdpWatts: true,
      hasIntegratedGraphics: true,
    },
  },
  motherboard: {
    select: {
      socket: true,
      chipset: true,
      ramType: true,
      ramSlots: true,
      maxRamGB: true,
      formFactor: true,
    },
  },
  ram: {
    select: { type: true, modules: true, capacityGB: true, speedMHz: true },
  },
  gpu: {
    select: { chipset: true, vramGB: true, tdpWatts: true, lengthMm: true },
  },
  powerSupply: {
    select: { wattage: true, formFactor: true, efficiency: true },
  },
  pcCase: { select: { supportedFormFactors: true, sfxOnly: true } },
} satisfies Prisma.ProductSelect;

type PartRow = Prisma.ProductGetPayload<{ select: typeof PART_SELECT }>;

const SLOT_BY_CATEGORY = new Map(
  SLOTS.map((slot) => [SLOT_CATEGORY[slot], slot]),
);

// Emplacements dont les composants doivent avoir leurs caractéristiques structurées
const HARDWARE_FILTER: Partial<Record<Slot, Prisma.ProductWhereInput>> = {
  cpu: { cpu: { isNot: null } },
  motherboard: { motherboard: { isNot: null } },
  ram: { ram: { isNot: null } },
  gpu: { gpu: { isNot: null } },
  psu: { powerSupply: { isNot: null } },
  case: { pcCase: { isNot: null } },
};

export interface ConfiguratorPart extends BuildPart {
  slug: string;
  brand: string;
  stockQuantity: number;
  image: { url: string; altText: string | null } | null;
  highlights: string[];
}

function highlights(row: PartRow): string[] {
  const spec = (name: string) =>
    row.specs.find((s) => s.name === name)?.valueText;
  if (row.cpu)
    return [row.cpu.socket, `${row.cpu.cores} cœurs`, `${row.cpu.tdpWatts} W`];
  if (row.motherboard) {
    const mb = row.motherboard;
    return [mb.socket, mb.ramType, FORM_FACTOR_LABELS[mb.formFactor]];
  }
  if (row.ram)
    return [
      row.ram.type,
      `${row.ram.capacityGB} Go`,
      `${row.ram.speedMHz} MHz`,
    ];
  if (row.gpu) return [`${row.gpu.vramGB} Go`, `${row.gpu.tdpWatts} W`];
  if (row.powerSupply)
    return [
      `${row.powerSupply.wattage} W`,
      row.powerSupply.formFactor,
      row.powerSupply.efficiency,
    ];
  if (row.pcCase) {
    const formats = row.pcCase.supportedFormFactors.map(
      (f) => FORM_FACTOR_LABELS[f],
    );
    return row.pcCase.sfxOnly ? [...formats, 'Alim. SFX'] : formats;
  }
  return [spec('Capacity'), spec('Form Factor'), spec('Interface')].filter(
    (v): v is string => !!v,
  );
}

function toPart(row: PartRow): ConfiguratorPart | null {
  const slot = SLOT_BY_CATEGORY.get(row.category.slug);
  if (!slot) return null;
  const hardware: Record<Slot, unknown> = {
    cpu: row.cpu,
    motherboard: row.motherboard,
    ram: row.ram,
    gpu: row.gpu,
    storage: true,
    psu: row.powerSupply,
    case: row.pcCase,
  };
  if (!hardware[slot]) return null; // caractéristiques inexploitables : hors configurateur
  return {
    id: row.id,
    slot,
    name: row.name,
    slug: row.slug,
    brand: row.brand.name,
    price: Number(row.price),
    stockQuantity: row.stockQuantity,
    image: row.images[0] ?? null,
    highlights: highlights(row),
    cpu: row.cpu ?? undefined,
    motherboard: row.motherboard ?? undefined,
    ram: row.ram ?? undefined,
    gpu: row.gpu ?? undefined,
    psu: row.powerSupply ?? undefined,
    pcCase: row.pcCase ?? undefined,
  };
}

export function parseIds(raw: unknown): number[] {
  if (raw === undefined || raw === null || raw === '') return [];
  const values: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [raw];
  const ids = values.map((v) =>
    int(typeof v === 'string' ? v.trim() : v, 'Identifiant de composant', {
      min: 1,
    }),
  );
  if (ids.length > SLOTS.length)
    throw badRequest(
      `Une configuration contient au plus ${SLOTS.length} composants`,
    );
  return [...new Set(ids)];
}

function parseSlot(raw: unknown): Slot {
  if (typeof raw === 'string' && (SLOTS as readonly string[]).includes(raw))
    return raw as Slot;
  throw badRequest(`Emplacement invalide (attendu : ${SLOTS.join(', ')})`);
}

@Injectable()
export class ConfiguratorService {
  constructor(private readonly prisma: PrismaService) {}

  /** Charge les composants sélectionnés et les range par emplacement (un seul par emplacement). */
  private async loadBuild(
    ids: number[],
  ): Promise<{ build: Build; parts: ConfiguratorPart[] }> {
    if (!ids.length) return { build: {}, parts: [] };
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: PART_SELECT,
    });

    const parts = rows.map(toPart);
    const missing = ids.filter((id) => !parts.some((p) => p?.id === id));
    if (missing.length) {
      throw new NotFoundException(
        `Composant(s) introuvable(s) ou indisponible(s) pour le configurateur : ${missing.join(', ')}`,
      );
    }

    const build: Build = {};
    for (const part of parts as ConfiguratorPart[]) {
      if (build[part.slot])
        throw badRequest(`Un seul composant par emplacement (${part.slot})`);
      build[part.slot] = part;
    }
    return {
      build,
      parts: SLOTS.map(
        (slot) => build[slot] as ConfiguratorPart | undefined,
      ).filter((p) => !!p),
    };
  }

  /** Composants en stock compatibles avec la sélection, pour un emplacement. */
  async parts(rawSlot: unknown, rawIds: unknown) {
    const slot = parseSlot(rawSlot);
    const { build } = await this.loadBuild(parseIds(rawIds));
    delete build[slot]; // le composant actuel de cet emplacement peut être remplacé

    const rows = await this.prisma.product.findMany({
      where: {
        isActive: true,
        stockQuantity: { gt: 0 },
        category: { slug: SLOT_CATEGORY[slot] },
        ...HARDWARE_FILTER[slot],
        ...(slot === 'storage'
          ? {
              NOT: { specs: { some: { name: 'Interface', valueText: 'U.2' } } },
            }
          : {}),
      },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      select: PART_SELECT,
    });

    const candidates = rows
      .map(toPart)
      .filter((p): p is ConfiguratorPart => !!p);
    const items = candidates.filter((part) => fits(part, build));
    return { slot, items, hidden: candidates.length - items.length };
  }

  /** Vérifie une configuration et renvoie les composants, le bilan de compatibilité et le total. */
  async check(rawIds: unknown) {
    const { build, parts } = await this.loadBuild(parseIds(rawIds));
    const evaluation = evaluate(build);
    const totalPrice =
      Math.round(parts.reduce((sum, p) => sum + p.price, 0) * 1000) / 1000;
    return { parts, totalPrice, ...evaluation };
  }

  // --- CONFIGURATIONS ENREGISTRÉES ---

  async listConfigurations(userId: number) {
    const configurations = await this.prisma.configuration.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                price: true,
                isActive: true,
                images: {
                  select: { url: true },
                  take: 1,
                  orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    return configurations.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      itemCount: c.items.length,
      totalPrice:
        Math.round(
          c.items.reduce(
            (sum, i) => sum + Number(i.product.price) * i.quantity,
            0,
          ) * 1000,
        ) / 1000,
      unavailableCount: c.items.filter((i) => !i.product.isActive).length,
      images: c.items
        .map((i) => i.product.images[0]?.url)
        .filter(Boolean)
        .slice(0, 4),
    }));
  }

  async getConfiguration(userId: number, id: number) {
    const configuration = await this.prisma.configuration.findFirst({
      where: { id, userId },
      include: {
        items: {
          select: { productId: true, product: { select: { isActive: true } } },
        },
      },
    });
    if (!configuration)
      throw new NotFoundException('Configuration introuvable');

    // Les composants retirés de la vente depuis l'enregistrement sont signalés et ignorés
    const activeIds = configuration.items
      .filter((i) => i.product.isActive)
      .map((i) => i.productId);
    const unavailable = configuration.items.length - activeIds.length;
    return {
      id: configuration.id,
      name: configuration.name,
      createdAt: configuration.createdAt,
      updatedAt: configuration.updatedAt,
      unavailable,
      ...(await this.check(activeIds)),
    };
  }

  async createConfiguration(userId: number, body: unknown) {
    const { name, ids } = await this.parseConfiguration(body);
    const count = await this.prisma.configuration.count({ where: { userId } });
    if (count >= MAX_CONFIGURATIONS_PER_USER) {
      throw badRequest(
        `Vous avez atteint la limite de ${MAX_CONFIGURATIONS_PER_USER} configurations enregistrées`,
      );
    }

    const created = await this.prisma.configuration.create({
      data: {
        userId,
        name,
        items: { create: ids.map((productId) => ({ productId })) },
      },
    });
    return this.getConfiguration(userId, created.id);
  }

  async updateConfiguration(userId: number, id: number, body: unknown) {
    const existing = await this.prisma.configuration.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Configuration introuvable');
    const { name, ids } = await this.parseConfiguration(body);

    await this.prisma.$transaction([
      this.prisma.configurationItem.deleteMany({
        where: { configurationId: id },
      }),
      this.prisma.configuration.update({
        where: { id },
        data: {
          name,
          items: { create: ids.map((productId) => ({ productId })) },
        },
      }),
    ]);
    return this.getConfiguration(userId, id);
  }

  async deleteConfiguration(userId: number, id: number) {
    const { count } = await this.prisma.configuration.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Configuration introuvable');
    return { deleted: true };
  }

  // Seule une configuration compatible peut être enregistrée
  private async parseConfiguration(body: unknown) {
    const b = asRecord(body);
    const name = text(b.name);
    if (!name) throw badRequest('Donnez un nom à votre configuration');
    if (name.length > 80)
      throw badRequest('Le nom est trop long (80 caractères maximum)');

    const ids = parseIds(b.productIds);
    if (!ids.length) throw badRequest('Choisissez au moins un composant');

    const { checks, valid } = await this.check(ids);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: checks
          .filter((c) => c.status === 'error')
          .map((c) => c.message),
      });
    }
    return { name, ids };
  }
}
