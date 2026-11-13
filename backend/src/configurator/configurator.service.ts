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
import { tr } from '../common/i18n';

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
  // Poste de travail (utilisé aussi par la vue 3D : taille d'écran, format du clavier…)
  monitor: {
    select: {
      screenSizeIn: true,
      resolutionWidth: true,
      resolutionHeight: true,
      refreshRateHz: true,
      panelType: true,
    },
  },
  keyboard: {
    select: {
      wireless: true,
      tenkeyless: true,
      style: true,
      switches: true,
      backlight: true,
    },
  },
  mouse: { select: { wireless: true, maxDpi: true } },
  headset: { select: { wireless: true, microphone: true, type: true } },
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
  monitor: { monitor: { isNot: null } },
  keyboard: { keyboard: { isNot: null } },
  mouse: { mouse: { isNot: null } },
  headset: { headset: { isNot: null } },
};

export interface ConfiguratorPart extends BuildPart {
  slug: string;
  brand: string;
  stockQuantity: number;
  image: { url: string; altText: string | null } | null;
  highlights: string[];
  cooler?: { liquid: boolean; radiatorMm: number | null };
  monitor?: {
    screenSizeIn: number;
    resolutionWidth: number;
    resolutionHeight: number;
    refreshRateHz: number;
    panelType: string | null;
  };
  keyboard?: {
    wireless: boolean;
    tenkeyless: boolean;
    style: string | null;
    switches: string | null;
    backlight: string | null;
  };
  mouse?: { wireless: boolean; maxDpi: number | null };
  headset?: { wireless: boolean; microphone: boolean; type: string | null };
}

/** Ventirad : watercooling AIO (taille du radiateur) ou ventirad à air, d'après les specs. */
function coolerOf(row: PartRow) {
  const radiator = row.specs.find((s) => s.name === 'Radiator Size')?.valueText;
  const mm = radiator ? Number.parseInt(radiator, 10) : NaN;
  const liquid = !!radiator || /\bAIO\b/i.test(row.name);
  return { liquid, radiatorMm: Number.isFinite(mm) ? mm : liquid ? 240 : null };
}

function highlights(row: PartRow): string[] {
  const spec = (name: string) =>
    row.specs.find((s) => s.name === name)?.valueText;
  if (row.cpu)
    return [
      row.cpu.socket,
      tr(`${row.cpu.cores} cœurs`, `${row.cpu.cores} cores`),
      `${row.cpu.tdpWatts} W`,
    ];
  if (row.motherboard) {
    const mb = row.motherboard;
    return [mb.socket, mb.ramType, FORM_FACTOR_LABELS[mb.formFactor]];
  }
  if (row.ram)
    return [
      row.ram.type,
      tr(`${row.ram.capacityGB} Go`, `${row.ram.capacityGB} GB`),
      `${row.ram.speedMHz} MHz`,
    ];
  if (row.gpu)
    return [
      tr(`${row.gpu.vramGB} Go`, `${row.gpu.vramGB} GB`),
      `${row.gpu.tdpWatts} W`,
    ];
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
    return row.pcCase.sfxOnly
      ? [...formats, tr('Alim. SFX', 'SFX PSU')]
      : formats;
  }
  if (row.monitor) {
    const m = row.monitor;
    return [
      `${Number(m.screenSizeIn)}"`,
      `${m.resolutionWidth}×${m.resolutionHeight}`,
      `${m.refreshRateHz} Hz`,
    ];
  }
  if (row.keyboard) {
    const k = row.keyboard;
    return [
      k.tenkeyless ? 'TKL' : tr('Complet', 'Full-size'),
      k.wireless ? tr('Sans fil', 'Wireless') : tr('Filaire', 'Wired'),
      k.switches ?? k.backlight,
    ].filter((v): v is string => !!v);
  }
  if (row.mouse) {
    return [
      row.mouse.wireless ? tr('Sans fil', 'Wireless') : tr('Filaire', 'Wired'),
      row.mouse.maxDpi ? `${row.mouse.maxDpi} DPI` : null,
    ].filter((v): v is string => !!v);
  }
  if (row.headset) {
    return [
      row.headset.wireless
        ? tr('Sans fil', 'Wireless')
        : tr('Filaire', 'Wired'),
      row.headset.microphone ? tr('Micro', 'Mic') : tr('Sans micro', 'No mic'),
    ];
  }
  if (row.category.slug === SLOT_CATEGORY.cooler) {
    const { liquid, radiatorMm } = coolerOf(row);
    return [
      liquid ? `AIO ${radiatorMm} mm` : tr('Ventirad à air', 'Air cooler'),
      spec('Fan RPM'),
      spec('Noise Level'),
    ].filter((v): v is string => !!v);
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
    cooler: true,
    monitor: row.monitor,
    keyboard: row.keyboard,
    mouse: row.mouse,
    headset: row.headset,
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
    cooler: slot === 'cooler' ? coolerOf(row) : undefined,
    monitor: row.monitor
      ? { ...row.monitor, screenSizeIn: Number(row.monitor.screenSizeIn) }
      : undefined,
    keyboard: row.keyboard ?? undefined,
    mouse: row.mouse ?? undefined,
    headset: row.headset ?? undefined,
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
    int(
      typeof v === 'string' ? v.trim() : v,
      tr('Identifiant de composant', 'Component ID'),
      {
        min: 1,
      },
    ),
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
        tr(
          `Composant(s) introuvable(s) ou indisponible(s) pour le configurateur : ${missing.join(', ')}`,
          `Component(s) not found or unavailable for the configurator: ${missing.join(', ')}`,
        ),
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
      throw new NotFoundException(
        tr('Configuration introuvable', 'Configuration not found'),
      );

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
        tr(
          `Vous avez atteint la limite de ${MAX_CONFIGURATIONS_PER_USER} configurations enregistrées`,
          `You have reached the limit of ${MAX_CONFIGURATIONS_PER_USER} saved configurations`,
        ),
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
    if (!existing)
      throw new NotFoundException(
        tr('Configuration introuvable', 'Configuration not found'),
      );
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
    if (!count)
      throw new NotFoundException(
        tr('Configuration introuvable', 'Configuration not found'),
      );
    return { deleted: true };
  }

  // Seule une configuration compatible peut être enregistrée
  private async parseConfiguration(body: unknown) {
    const b = asRecord(body);
    const name = text(b.name);
    if (!name)
      throw badRequest(
        tr(
          'Donnez un nom à votre configuration',
          'Give your configuration a name',
        ),
      );
    if (name.length > 80)
      throw badRequest(
        tr(
          'Le nom est trop long (80 caractères maximum)',
          'The name is too long (80 characters maximum)',
        ),
      );

    const ids = parseIds(b.productIds);
    if (!ids.length)
      throw badRequest(
        tr('Choisissez au moins un composant', 'Choose at least one component'),
      );

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
