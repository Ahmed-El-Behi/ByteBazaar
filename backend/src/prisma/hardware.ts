// =====================================================================
// Caractéristiques structurées des composants (tables Cpu, Motherboard,
// Ram, Gpu, PowerSupply, PcCase) déduites des specs texte du catalogue.
//
// La source (PCPartPicker) ne fournit pas tout : le socket des CPU, le
// type de RAM des cartes mères et la consommation des GPU sont déduits de
// faits constructeurs (tables ci-dessous). Chaque fonction renvoie `null`
// quand le produit ne peut pas être utilisé dans le configurateur.
// =====================================================================

import type { FormFactor, RamType } from '../generated/prisma/client';

export interface HardwareSource {
  categorySlug: string;
  name: string;
  specs?: { name: string; valueText: string }[];
  source?: { url?: string };
}

const spec = (p: HardwareSource, key: string) =>
  p.specs?.find((s) => s.name === key)?.valueText?.trim() ?? '';
const firstNumber = (value: string) => {
  const match = /(\d+(?:\.\d+)?)/.exec(value.replace(',', '.'));
  return match ? Number(match[1]) : null;
};
const sourceSlug = (p: HardwareSource) => (p.source?.url ?? '').toLowerCase();

// ------------------------------------------------------------------ CPU

// Microarchitecture → socket (gammes de bureau AMD Ryzen / Intel Core)
const SOCKET_BY_MICROARCHITECTURE: Record<string, string> = {
  'Zen 2': 'AM4',
  'Zen 3': 'AM4',
  'Zen 4': 'AM5',
  'Zen 5': 'AM5',
  'Comet Lake': 'LGA1200',
  'Rocket Lake': 'LGA1200',
  'Alder Lake': 'LGA1700',
  'Raptor Lake': 'LGA1700',
  'Raptor Lake Refresh': 'LGA1700',
  'Arrow Lake': 'LGA1851',
};

/** Types de mémoire pris en charge par chaque socket. */
export const MEMORY_BY_SOCKET: Record<string, RamType[]> = {
  AM4: ['DDR4'],
  AM5: ['DDR5'],
  LGA1200: ['DDR4'],
  LGA1700: ['DDR4', 'DDR5'], // dépend de la carte mère
  LGA1851: ['DDR5'],
};

export function cpuFromSpecs(p: HardwareSource) {
  const socket = SOCKET_BY_MICROARCHITECTURE[spec(p, 'Microarchitecture')];
  const cores = firstNumber(spec(p, 'Core Count'));
  const base = firstNumber(spec(p, 'Performance Core Clock'));
  const tdp = firstNumber(spec(p, 'TDP'));
  if (!socket || !cores || !base || !tdp) return null;

  const igpu = spec(p, 'Integrated Graphics');
  return {
    socket,
    cores,
    threads: null,
    baseClockGHz: base,
    boostClockGHz: firstNumber(spec(p, 'Performance Core Boost Clock')),
    tdpWatts: tdp,
    hasIntegratedGraphics: igpu !== '' && igpu.toLowerCase() !== 'none',
  };
}

// ------------------------------------------------------------------ Carte mère

const FORM_FACTORS: Record<string, FormFactor> = {
  ATX: 'ATX',
  'Micro ATX': 'MICRO_ATX',
  'Mini ITX': 'MINI_ITX',
  'Mini DTX': 'MINI_ITX', // Mini-DTX : même encombrement qu'une Mini-ITX en largeur
  EATX: 'E_ATX',
};

// Cartes LGA1700 DDR4 dont le nom ne porte pas la mention D4 (fiches constructeur)
const LGA1700_DDR4_WITHOUT_SUFFIX = new Set([
  'ASRock H610M-HDV/M.2',
  'ASRock H610M-HVS/M.2 R2.0',
]);
// Cartes à mémoire SO-DIMM (portable) : incompatibles avec les barrettes du catalogue
const SODIMM_BOARDS = new Set(['ASRock H610M-ITX/eDP']);
// Noms qui ne contiennent pas le chipset sous sa forme habituelle (préfixe → chipset)
const CHIPSET_OVERRIDES: Record<string, string> = {
  'Asus ROG Crosshair VIII Impact': 'X570',
  'NZXT N7-B85XT': 'B850',
};

function boardRamType(p: HardwareSource, socket: string): RamType | null {
  const supported = MEMORY_BY_SOCKET[socket];
  if (!supported) return null;
  if (supported.length === 1) return supported[0];

  // LGA1700 : la variante DDR4 est signalée dans le nom ("D4", "/D4", "DDR4")
  const text = `${p.name} ${sourceSlug(p)}`.toUpperCase();
  if (
    /(^|[\s/-])D(DR)?4\b/.test(text) ||
    LGA1700_DDR4_WITHOUT_SUFFIX.has(p.name)
  )
    return 'DDR4';
  return 'DDR5';
}

export function motherboardFromSpecs(p: HardwareSource) {
  if (SODIMM_BOARDS.has(p.name)) return null;
  const socket = spec(p, 'Socket / CPU');
  const formFactor = FORM_FACTORS[spec(p, 'Form Factor')];
  const ramType = boardRamType(p, socket);
  const ramSlots = firstNumber(spec(p, 'Memory Slots'));
  const maxRamGB = firstNumber(spec(p, 'Memory Max'));
  if (!formFactor || !ramType || !ramSlots || !maxRamGB) return null;

  const override = Object.entries(CHIPSET_OVERRIDES).find(([prefix]) =>
    p.name.startsWith(prefix),
  );
  // B650, B650E, X870E, Z790, H610M → H610, Z890I → Z890…
  const chipset =
    override?.[1] ??
    /\b([ABHXZ]\d{3}E?)/i.exec(p.name)?.[1]?.toUpperCase() ??
    'Inconnu';

  return { socket, chipset, formFactor, ramType, ramSlots, maxRamGB };
}

// ------------------------------------------------------------------ RAM

export function ramFromSpecs(p: HardwareSource) {
  if (sourceSlug(p).includes('sodimm')) return null; // barrettes pour portable
  const speed = /^(DDR4|DDR5)-(\d+)/.exec(spec(p, 'Speed'));
  const modules = /(\d+)\s*x\s*(\d+)\s*GB/i.exec(spec(p, 'Modules'));
  if (!speed || !modules) return null;
  const count = Number(modules[1]);
  return {
    type: speed[1] as RamType,
    speedMHz: Number(speed[2]),
    modules: count,
    capacityGB: count * Number(modules[2]),
  };
}

// ------------------------------------------------------------------ GPU

// Consommation (Total Board Power, W) des puces de référence NVIDIA / AMD
const GPU_BOARD_POWER: Record<string, number> = {
  'GeForce RTX 5090': 575,
  'GeForce RTX 5080': 360,
  'GeForce RTX 5070 Ti': 300,
  'GeForce RTX 5070': 250,
  'GeForce RTX 5060 Ti': 180,
  'GeForce RTX 5060': 145,
  'GeForce RTX 5050': 130,
  'GeForce RTX 4090': 450,
  'GeForce RTX 4080 SUPER': 320,
  'GeForce RTX 4080': 320,
  'GeForce RTX 4070 Ti SUPER': 285,
  'GeForce RTX 4070 Ti': 285,
  'GeForce RTX 4070 SUPER': 220,
  'GeForce RTX 4070': 200,
  'GeForce RTX 4060 Ti': 160,
  'GeForce RTX 4060': 115,
  'GeForce RTX 3090 Ti': 450,
  'GeForce RTX 3090': 350,
  'GeForce RTX 3080 Ti': 350,
  'GeForce RTX 3080 12GB': 350,
  'GeForce RTX 3080': 320,
  'GeForce RTX 3070 Ti': 290,
  'GeForce RTX 3070': 220,
  'GeForce RTX 3060 Ti': 200,
  'GeForce RTX 3060': 170,
  'GeForce RTX 3050 6GB': 70,
  'GeForce RTX 3050': 130,
  'GeForce RTX 2070': 175,
  'GeForce RTX 2060 SUPER': 175,
  'GeForce RTX 2060': 160,
  'Radeon RX 9070 XT': 304,
  'Radeon RX 9070': 220,
  'Radeon RX 9060 XT': 160,
  'Radeon RX 7900 XTX': 355,
  'Radeon RX 7900 XT': 315,
  'Radeon RX 7900 GRE': 260,
  'Radeon RX 7800 XT': 263,
  'Radeon RX 7700 XT': 245,
  'Radeon RX 7600 XT': 190,
  'Radeon RX 7600': 165,
  'Radeon RX 6950 XT': 335,
  'Radeon RX 6900 XT': 300,
  'Radeon RX 6800 XT': 300,
  'Radeon RX 6800': 250,
  'Radeon RX 6750 XT': 250,
  'Radeon RX 6700 XT': 230,
  'Radeon RX 6650 XT': 180,
  'Radeon RX 6600 XT': 160,
  'Radeon RX 6600': 132,
  'Radeon RX 6500 XT': 107,
  'Radeon RX 6400': 53,
  'RTX 5000 Ada Generation': 250,
  'RTX 4000 SFF Ada Generation': 70,
  'RTX 4000 Ada Generation': 130,
  'RTX 2000 Ada Generation': 70,
  'Quadro RTX 5000': 230,
  'Quadro RTX 4000': 160,
};

export function gpuBoardPower(chipset: string): number | null {
  const normalized = chipset
    .replace(/\bLHR\b/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Les puces déclinées par mémoire ("RTX 3080 12GB") ont leur propre entrée
  if (GPU_BOARD_POWER[normalized] !== undefined)
    return GPU_BOARD_POWER[normalized];
  const withoutMemory = normalized.replace(/\s*\d+GB$/, '');
  return GPU_BOARD_POWER[withoutMemory] ?? null;
}

export function gpuFromSpecs(p: HardwareSource) {
  const chipset = spec(p, 'Chipset');
  const tdpWatts = gpuBoardPower(chipset);
  const vramGB = firstNumber(spec(p, 'Memory'));
  const lengthMm = firstNumber(spec(p, 'Length'));
  if (!tdpWatts || !vramGB || !lengthMm) return null;
  return {
    chipset: chipset.replace(/\s*\d+GB\b/, '').trim(),
    vramGB,
    tdpWatts,
    lengthMm,
    recommendedPsuWatts: null,
  };
}

// ------------------------------------------------------------------ Alimentation

export function powerSupplyFromSpecs(p: HardwareSource) {
  const wattage = firstNumber(spec(p, 'Wattage'));
  if (!wattage) return null;
  const modular = spec(p, 'Modular');
  return {
    wattage,
    efficiency: spec(p, 'Efficiency Rating') || 'Non certifiée',
    isModular: modular !== '' && modular !== 'No',
    formFactor: spec(p, 'Type') || 'ATX',
  };
}

// ------------------------------------------------------------------ Boîtier

const CASE_FORM_FACTORS: Record<string, FormFactor[]> = {
  'ATX Full Tower': ['E_ATX', 'ATX', 'MICRO_ATX', 'MINI_ITX'],
  'ATX Mid Tower': ['ATX', 'MICRO_ATX', 'MINI_ITX'],
  'MicroATX Mid Tower': ['MICRO_ATX', 'MINI_ITX'],
  'MicroATX Mini Tower': ['MICRO_ATX', 'MINI_ITX'],
  'MicroATX Desktop': ['MICRO_ATX', 'MINI_ITX'],
  'Mini ITX Tower': ['MINI_ITX'],
  'Mini ITX Desktop': ['MINI_ITX'],
};

// Boîtiers « HTPC » : format selon la fiche Silverstone
const HTPC_FORM_FACTORS: Record<string, FormFactor[]> = {
  'Silverstone GD05B-USB3.0': ['MICRO_ATX', 'MINI_ITX'],
  'Silverstone GD07B': ['ATX', 'MICRO_ATX', 'MINI_ITX'],
  'Silverstone GD09B': ['ATX', 'MICRO_ATX', 'MINI_ITX'],
  'Silverstone GD11': ['ATX', 'MICRO_ATX', 'MINI_ITX'],
  'Silverstone ML08': ['MINI_ITX'],
  'Silverstone ML09': ['MINI_ITX'],
  'Silverstone RVZ02B': ['MINI_ITX'],
};

// Petits boîtiers qui n'acceptent qu'une alimentation SFX (fiches constructeur)
const SFX_ONLY_PREFIXES = [
  'Corsair 2000D',
  'Fractal Design Ridge',
  'Fractal Design Era ITX',
  'Fractal Design Terra',
  'HYTE REVOLT 3',
  'In Win A1 Plus',
  'Jonsbo N2',
  'Jonsbo N3',
  'Lian Li A4-H20',
  'Phanteks Enthoo EVOLV SHIFT X',
  'RAIJINTEK Metis Plus',
  'RAIJINTEK OPHION EVO',
  'Silverstone DS380B',
  'Silverstone ML08',
  'Silverstone ML09',
  'Silverstone RVZ02B',
  'Silverstone RVZ03',
  'Silverstone SG05',
  'SSUPD Meshlicious',
  'Thermaltake TR100',
];

export function pcCaseFromSpecs(p: HardwareSource) {
  const type = spec(p, 'Type');
  const htpc = Object.entries(HTPC_FORM_FACTORS).find(([prefix]) =>
    p.name.startsWith(prefix),
  )?.[1];
  const supportedFormFactors = type === 'HTPC' ? htpc : CASE_FORM_FACTORS[type];
  if (!supportedFormFactors) return null;
  return {
    supportedFormFactors,
    maxGpuLengthMm: null,
    sfxOnly: SFX_ONLY_PREFIXES.some((prefix) => p.name.startsWith(prefix)),
  };
}
