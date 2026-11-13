// =====================================================================
// Règles de compatibilité du configurateur (fonctions pures).
//
// Une seule implémentation sert à la fois à :
//   - filtrer les composants proposés pour un emplacement (seuls ceux qui
//     ne créent aucune erreur avec la sélection actuelle sont affichés) ;
//   - valider une configuration complète (sauvegarde, ajout au panier).
//
// Règles :
//   socket       CPU ↔ carte mère : même socket
//   mémoire      RAM ↔ carte mère : même type (DDR4/DDR5), nombre de barrettes
//                ≤ emplacements, capacité ≤ maximum ; sans carte mère, type
//                pris en charge par le socket du CPU
//   format       carte mère ↔ boîtier : format accepté par le boîtier
//   alimentation alim ↔ boîtier : SFX obligatoire dans les petits boîtiers,
//                ATX ou SFX ailleurs (Flex ATX / TFX non pris en charge)
//   puissance    alim ≥ puissance recommandée (CPU + GPU + reste, +25 %)
//   graphique    CPU sans partie graphique → carte graphique nécessaire
//                (avertissement : n'empêche pas une configuration partielle)
//   refroidiss.  CPU sans ventirad choisi → rappel (avertissement) ; le catalogue
//                n'indique pas les sockets pris en charge par les ventirads
//
// Le ventirad et les périphériques (écran, clavier, souris, casque) sont
// facultatifs : une configuration est « complète » avec les 7 pièces du PC.
// =====================================================================

import type { FormFactor, RamType } from '../generated/prisma/client';
import { tr } from '../common/i18n';
import { MEMORY_BY_SOCKET } from '../prisma/hardware';

/** Pièces indispensables au fonctionnement du PC. */
export const CORE_SLOTS = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
] as const;
/** Pièces facultatives : refroidissement et poste de travail. */
export const OPTIONAL_SLOTS = [
  'cooler',
  'monitor',
  'keyboard',
  'mouse',
  'headset',
] as const;
export const SLOTS = [...CORE_SLOTS, ...OPTIONAL_SLOTS] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_CATEGORY: Record<Slot, string> = {
  cpu: 'processeurs',
  motherboard: 'cartes-meres',
  ram: 'memoire-ram',
  gpu: 'cartes-graphiques',
  storage: 'stockage',
  psu: 'alimentations',
  case: 'boitiers',
  cooler: 'refroidissement',
  monitor: 'ecrans',
  keyboard: 'claviers',
  mouse: 'souris',
  headset: 'casques',
};

export interface BuildPart {
  id: number;
  slot: Slot;
  name: string;
  price: number;
  cpu?: { socket: string; tdpWatts: number; hasIntegratedGraphics: boolean };
  motherboard?: {
    socket: string;
    ramType: RamType;
    ramSlots: number;
    maxRamGB: number;
    formFactor: FormFactor;
  };
  ram?: { type: RamType; modules: number; capacityGB: number };
  gpu?: { tdpWatts: number };
  psu?: { wattage: number; formFactor: string };
  pcCase?: { supportedFormFactors: FormFactor[]; sfxOnly: boolean };
}

export type Build = Partial<Record<Slot, BuildPart>>;

export type CheckStatus = 'ok' | 'error' | 'warning' | 'pending';

export interface Check {
  id:
    | 'socket'
    | 'memory'
    | 'formFactor'
    | 'psuFormat'
    | 'power'
    | 'graphics'
    | 'cooling';
  status: CheckStatus;
  message: string;
  slots: Slot[];
}

export interface Evaluation {
  checks: Check[];
  valid: boolean;
  complete: boolean;
  estimatedWatts: number;
  recommendedPsuWatts: number;
}

export const FORM_FACTOR_LABELS: Record<FormFactor, string> = {
  ATX: 'ATX',
  MICRO_ATX: 'Micro-ATX',
  MINI_ITX: 'Mini-ITX',
  E_ATX: 'E-ATX',
};

// Carte mère, RAM, stockage, ventilateurs… : forfait ajouté à la consommation CPU + GPU
const OTHER_COMPONENTS_WATTS = 80;
const PSU_HEADROOM = 1.25;

export function powerBudget(build: Build) {
  const cpu = build.cpu?.cpu?.tdpWatts ?? 0;
  const gpu = build.gpu?.gpu?.tdpWatts ?? 0;
  if (!cpu && !gpu) return { estimatedWatts: 0, recommendedPsuWatts: 0 };
  const estimatedWatts = cpu + gpu + OTHER_COMPONENTS_WATTS;
  // Arrondi aux 50 W supérieurs, comme les gammes d'alimentations
  const recommendedPsuWatts =
    Math.ceil((estimatedWatts * PSU_HEADROOM) / 50) * 50;
  return { estimatedWatts, recommendedPsuWatts };
}

function socketCheck({ cpu, motherboard }: Build): Check {
  const slots: Slot[] = ['cpu', 'motherboard'];
  if (!cpu?.cpu || !motherboard?.motherboard) {
    return {
      id: 'socket',
      status: 'pending',
      message: tr(
        'Socket : en attente du processeur et de la carte mère',
        'Socket: waiting for the processor and the motherboard',
      ),
      slots,
    };
  }
  const [a, b] = [cpu.cpu.socket, motherboard.motherboard.socket];
  return a === b
    ? {
        id: 'socket',
        status: 'ok',
        message: tr(
          `Socket ${a} : processeur et carte mère compatibles`,
          `Socket ${a}: processor and motherboard are compatible`,
        ),
        slots,
      }
    : {
        id: 'socket',
        status: 'error',
        message: tr(
          `Socket incompatible : processeur ${a}, carte mère ${b}`,
          `Incompatible socket: processor ${a}, motherboard ${b}`,
        ),
        slots,
      };
}

function memoryCheck({ cpu, motherboard, ram }: Build): Check {
  if (!ram?.ram) {
    return {
      id: 'memory',
      status: 'pending',
      message: tr(
        'Mémoire : en attente de la RAM',
        'Memory: waiting for the RAM',
      ),
      slots: ['ram'],
    };
  }
  const r = ram.ram;

  if (motherboard?.motherboard) {
    const mb = motherboard.motherboard;
    const slots: Slot[] = ['ram', 'motherboard'];
    if (r.type !== mb.ramType) {
      return {
        id: 'memory',
        status: 'error',
        message: tr(
          `Mémoire ${r.type} incompatible avec la carte mère (${mb.ramType})`,
          `${r.type} memory is incompatible with the motherboard (${mb.ramType})`,
        ),
        slots,
      };
    }
    if (r.modules > mb.ramSlots) {
      return {
        id: 'memory',
        status: 'error',
        message: tr(
          `${r.modules} barrettes pour ${mb.ramSlots} emplacements sur la carte mère`,
          `${r.modules} modules for ${mb.ramSlots} slots on the motherboard`,
        ),
        slots,
      };
    }
    if (r.capacityGB > mb.maxRamGB) {
      return {
        id: 'memory',
        status: 'error',
        message: tr(
          `${r.capacityGB} Go de RAM : la carte mère accepte ${mb.maxRamGB} Go maximum`,
          `${r.capacityGB} GB of RAM: the motherboard supports ${mb.maxRamGB} GB maximum`,
        ),
        slots,
      };
    }
    return {
      id: 'memory',
      status: 'ok',
      message: tr(
        `Mémoire ${r.type} compatible (${r.modules}/${mb.ramSlots} emplacements)`,
        `${r.type} memory is compatible (${r.modules}/${mb.ramSlots} slots)`,
      ),
      slots,
    };
  }

  if (cpu?.cpu) {
    const slots: Slot[] = ['ram', 'cpu'];
    const supported = MEMORY_BY_SOCKET[cpu.cpu.socket] ?? [];
    return supported.includes(r.type)
      ? {
          id: 'memory',
          status: 'ok',
          message: tr(
            `Mémoire ${r.type} prise en charge par le processeur`,
            `${r.type} memory is supported by the processor`,
          ),
          slots,
        }
      : {
          id: 'memory',
          status: 'error',
          message: tr(
            `Le processeur (${cpu.cpu.socket}) ne prend pas en charge la ${r.type}`,
            `The processor (${cpu.cpu.socket}) does not support ${r.type}`,
          ),
          slots,
        };
  }

  return {
    id: 'memory',
    status: 'pending',
    message: tr(
      `Mémoire ${r.type} : en attente de la carte mère`,
      `${r.type} memory: waiting for the motherboard`,
    ),
    slots: ['ram'],
  };
}

function formFactorCheck({ motherboard, case: pcCase }: Build): Check {
  const slots: Slot[] = ['motherboard', 'case'];
  if (!motherboard?.motherboard || !pcCase?.pcCase) {
    return {
      id: 'formFactor',
      status: 'pending',
      message: tr(
        'Format : en attente de la carte mère et du boîtier',
        'Form factor: waiting for the motherboard and the case',
      ),
      slots,
    };
  }
  const format = FORM_FACTOR_LABELS[motherboard.motherboard.formFactor];
  return pcCase.pcCase.supportedFormFactors.includes(
    motherboard.motherboard.formFactor,
  )
    ? {
        id: 'formFactor',
        status: 'ok',
        message: tr(
          `Carte mère ${format} compatible avec le boîtier`,
          `${format} motherboard is compatible with the case`,
        ),
        slots,
      }
    : {
        id: 'formFactor',
        status: 'error',
        message: tr(
          `Le boîtier n'accepte pas les cartes mères ${format}`,
          `The case does not accept ${format} motherboards`,
        ),
        slots,
      };
}

function psuFormatCheck({ psu, case: pcCase }: Build): Check {
  const slots: Slot[] = ['psu', 'case'];
  if (!psu?.psu || !pcCase?.pcCase) {
    return {
      id: 'psuFormat',
      status: 'pending',
      message: tr(
        "Format d'alimentation : en attente de l'alimentation et du boîtier",
        'Power supply form factor: waiting for the power supply and the case',
      ),
      slots,
    };
  }
  const format = psu.psu.formFactor;
  const allowed = pcCase.pcCase.sfxOnly ? ['SFX'] : ['ATX', 'SFX'];
  if (allowed.includes(format)) {
    return {
      id: 'psuFormat',
      status: 'ok',
      message: tr(
        `Alimentation ${format} compatible avec le boîtier`,
        `${format} power supply is compatible with the case`,
      ),
      slots,
    };
  }
  return {
    id: 'psuFormat',
    status: 'error',
    message: pcCase.pcCase.sfxOnly
      ? tr(
          "Ce boîtier compact n'accepte que les alimentations SFX",
          'This compact case only accepts SFX power supplies',
        )
      : tr(
          `Format d'alimentation ${format} non pris en charge par le boîtier`,
          `${format} power supply form factor is not supported by the case`,
        ),
    slots,
  };
}

function powerCheck(build: Build): Check {
  const { estimatedWatts, recommendedPsuWatts } = powerBudget(build);
  const slots: Slot[] = ['psu', 'cpu', 'gpu'];
  if (!build.psu?.psu) {
    return {
      id: 'power',
      status: 'pending',
      message: recommendedPsuWatts
        ? tr(
            `Puissance : alimentation de ${recommendedPsuWatts} W minimum recommandée`,
            `Power: a power supply of at least ${recommendedPsuWatts} W is recommended`,
          )
        : tr(
            "Puissance : en attente de l'alimentation",
            'Power: waiting for the power supply',
          ),
      slots,
    };
  }
  const wattage = build.psu.psu.wattage;
  if (!recommendedPsuWatts) {
    return {
      id: 'power',
      status: 'pending',
      message: tr(
        `Alimentation ${wattage} W : en attente du processeur ou de la carte graphique`,
        `${wattage} W power supply: waiting for the processor or the graphics card`,
      ),
      slots,
    };
  }
  return wattage >= recommendedPsuWatts
    ? {
        id: 'power',
        status: 'ok',
        message: tr(
          `Puissance suffisante (${estimatedWatts} W estimés, ${wattage} W disponibles)`,
          `Sufficient power (${estimatedWatts} W estimated, ${wattage} W available)`,
        ),
        slots,
      }
    : {
        id: 'power',
        status: 'error',
        message: tr(
          `Alimentation sous-dimensionnée : ${recommendedPsuWatts} W recommandés, ${wattage} W choisis`,
          `Undersized power supply: ${recommendedPsuWatts} W recommended, ${wattage} W selected`,
        ),
        slots,
      };
}

function graphicsCheck({ cpu, gpu }: Build): Check {
  const slots: Slot[] = ['cpu', 'gpu'];
  if (gpu)
    return {
      id: 'graphics',
      status: 'ok',
      message: tr(
        'Affichage : carte graphique dédiée',
        'Display: dedicated graphics card',
      ),
      slots,
    };
  if (!cpu?.cpu)
    return {
      id: 'graphics',
      status: 'pending',
      message: tr(
        'Affichage : en attente du processeur ou de la carte graphique',
        'Display: waiting for the processor or the graphics card',
      ),
      slots,
    };
  return cpu.cpu.hasIntegratedGraphics
    ? {
        id: 'graphics',
        status: 'ok',
        message: tr(
          'Affichage : partie graphique intégrée au processeur',
          'Display: graphics integrated into the processor',
        ),
        slots,
      }
    : {
        id: 'graphics',
        status: 'warning',
        message: tr(
          "Ce processeur n'a pas de partie graphique : ajoutez une carte graphique",
          'This processor has no integrated graphics: add a graphics card',
        ),
        slots,
      };
}

function coolingCheck({ cpu, cooler }: Build): Check {
  const slots: Slot[] = ['cpu', 'cooler'];
  if (cooler) {
    return {
      id: 'cooling',
      status: 'ok',
      message: tr(
        'Refroidissement du processeur choisi',
        'Processor cooling selected',
      ),
      slots,
    };
  }
  if (!cpu) {
    return {
      id: 'cooling',
      status: 'pending',
      message: tr(
        'Refroidissement : en attente du processeur',
        'Cooling: waiting for the processor',
      ),
      slots,
    };
  }
  return {
    id: 'cooling',
    status: 'warning',
    message: tr(
      'Pensez au refroidissement : la plupart des processeurs récents sont vendus sans ventirad',
      'Remember cooling: most recent processors are sold without a CPU cooler',
    ),
    slots,
  };
}

export function evaluate(build: Build): Evaluation {
  const checks = [
    socketCheck,
    memoryCheck,
    formFactorCheck,
    psuFormatCheck,
    powerCheck,
    graphicsCheck,
    coolingCheck,
  ].map((rule) => rule(build));
  return {
    checks,
    valid: checks.every((c) => c.status !== 'error'),
    // Complète = les 7 pièces du PC et aucune erreur (ventirad et périphériques facultatifs)
    complete:
      CORE_SLOTS.every((slot) => !!build[slot]) &&
      checks.every(
        (c) =>
          c.status !== 'error' &&
          c.status !== 'pending' &&
          (c.status !== 'warning' || c.id === 'cooling'),
      ),
    ...powerBudget(build),
  };
}

/** Vrai si `candidate` peut occuper son emplacement sans créer d'erreur avec le reste de la sélection. */
export function fits(candidate: BuildPart, build: Build): boolean {
  const next: Build = { ...build, [candidate.slot]: candidate };
  return evaluate(next).checks.every(
    (c) => c.status !== 'error' || !c.slots.includes(candidate.slot),
  );
}
