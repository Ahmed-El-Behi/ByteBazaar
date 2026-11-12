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
      message: 'Socket : en attente du processeur et de la carte mère',
      slots,
    };
  }
  const [a, b] = [cpu.cpu.socket, motherboard.motherboard.socket];
  return a === b
    ? {
        id: 'socket',
        status: 'ok',
        message: `Socket ${a} : processeur et carte mère compatibles`,
        slots,
      }
    : {
        id: 'socket',
        status: 'error',
        message: `Socket incompatible : processeur ${a}, carte mère ${b}`,
        slots,
      };
}

function memoryCheck({ cpu, motherboard, ram }: Build): Check {
  if (!ram?.ram) {
    return {
      id: 'memory',
      status: 'pending',
      message: 'Mémoire : en attente de la RAM',
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
        message: `Mémoire ${r.type} incompatible avec la carte mère (${mb.ramType})`,
        slots,
      };
    }
    if (r.modules > mb.ramSlots) {
      return {
        id: 'memory',
        status: 'error',
        message: `${r.modules} barrettes pour ${mb.ramSlots} emplacements sur la carte mère`,
        slots,
      };
    }
    if (r.capacityGB > mb.maxRamGB) {
      return {
        id: 'memory',
        status: 'error',
        message: `${r.capacityGB} Go de RAM : la carte mère accepte ${mb.maxRamGB} Go maximum`,
        slots,
      };
    }
    return {
      id: 'memory',
      status: 'ok',
      message: `Mémoire ${r.type} compatible (${r.modules}/${mb.ramSlots} emplacements)`,
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
          message: `Mémoire ${r.type} prise en charge par le processeur`,
          slots,
        }
      : {
          id: 'memory',
          status: 'error',
          message: `Le processeur (${cpu.cpu.socket}) ne prend pas en charge la ${r.type}`,
          slots,
        };
  }

  return {
    id: 'memory',
    status: 'pending',
    message: `Mémoire ${r.type} : en attente de la carte mère`,
    slots: ['ram'],
  };
}

function formFactorCheck({ motherboard, case: pcCase }: Build): Check {
  const slots: Slot[] = ['motherboard', 'case'];
  if (!motherboard?.motherboard || !pcCase?.pcCase) {
    return {
      id: 'formFactor',
      status: 'pending',
      message: 'Format : en attente de la carte mère et du boîtier',
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
        message: `Carte mère ${format} compatible avec le boîtier`,
        slots,
      }
    : {
        id: 'formFactor',
        status: 'error',
        message: `Le boîtier n'accepte pas les cartes mères ${format}`,
        slots,
      };
}

function psuFormatCheck({ psu, case: pcCase }: Build): Check {
  const slots: Slot[] = ['psu', 'case'];
  if (!psu?.psu || !pcCase?.pcCase) {
    return {
      id: 'psuFormat',
      status: 'pending',
      message:
        "Format d'alimentation : en attente de l'alimentation et du boîtier",
      slots,
    };
  }
  const format = psu.psu.formFactor;
  const allowed = pcCase.pcCase.sfxOnly ? ['SFX'] : ['ATX', 'SFX'];
  if (allowed.includes(format)) {
    return {
      id: 'psuFormat',
      status: 'ok',
      message: `Alimentation ${format} compatible avec le boîtier`,
      slots,
    };
  }
  return {
    id: 'psuFormat',
    status: 'error',
    message: pcCase.pcCase.sfxOnly
      ? "Ce boîtier compact n'accepte que les alimentations SFX"
      : `Format d'alimentation ${format} non pris en charge par le boîtier`,
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
        ? `Puissance : alimentation de ${recommendedPsuWatts} W minimum recommandée`
        : "Puissance : en attente de l'alimentation",
      slots,
    };
  }
  const wattage = build.psu.psu.wattage;
  if (!recommendedPsuWatts) {
    return {
      id: 'power',
      status: 'pending',
      message: `Alimentation ${wattage} W : en attente du processeur ou de la carte graphique`,
      slots,
    };
  }
  return wattage >= recommendedPsuWatts
    ? {
        id: 'power',
        status: 'ok',
        message: `Puissance suffisante (${estimatedWatts} W estimés, ${wattage} W disponibles)`,
        slots,
      }
    : {
        id: 'power',
        status: 'error',
        message: `Alimentation sous-dimensionnée : ${recommendedPsuWatts} W recommandés, ${wattage} W choisis`,
        slots,
      };
}

function graphicsCheck({ cpu, gpu }: Build): Check {
  const slots: Slot[] = ['cpu', 'gpu'];
  if (gpu)
    return {
      id: 'graphics',
      status: 'ok',
      message: 'Affichage : carte graphique dédiée',
      slots,
    };
  if (!cpu?.cpu)
    return {
      id: 'graphics',
      status: 'pending',
      message: 'Affichage : en attente du processeur ou de la carte graphique',
      slots,
    };
  return cpu.cpu.hasIntegratedGraphics
    ? {
        id: 'graphics',
        status: 'ok',
        message: 'Affichage : partie graphique intégrée au processeur',
        slots,
      }
    : {
        id: 'graphics',
        status: 'warning',
        message:
          "Ce processeur n'a pas de partie graphique : ajoutez une carte graphique",
        slots,
      };
}

function coolingCheck({ cpu, cooler }: Build): Check {
  const slots: Slot[] = ['cpu', 'cooler'];
  if (cooler) {
    return {
      id: 'cooling',
      status: 'ok',
      message: 'Refroidissement du processeur choisi',
      slots,
    };
  }
  if (!cpu) {
    return {
      id: 'cooling',
      status: 'pending',
      message: 'Refroidissement : en attente du processeur',
      slots,
    };
  }
  return {
    id: 'cooling',
    status: 'warning',
    message:
      'Pensez au refroidissement : la plupart des processeurs récents sont vendus sans ventirad',
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
