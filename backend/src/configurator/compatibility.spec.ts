import { parseLang, withLang } from '../common/i18n';
import { evaluate, fits, powerBudget, type BuildPart } from './compatibility';

type Ram = 'DDR4' | 'DDR5';
type Format = 'ATX' | 'MICRO_ATX' | 'MINI_ITX';

const cpu = (
  id: number,
  socket: string,
  tdpWatts = 65,
  hasIntegratedGraphics = true,
): BuildPart => ({
  id,
  slot: 'cpu',
  name: `CPU ${socket}`,
  price: 500,
  cpu: { socket, tdpWatts, hasIntegratedGraphics },
});
const board = (
  id: number,
  socket: string,
  ramType: Ram,
  formFactor: Format = 'ATX',
  ramSlots = 4,
  maxRamGB = 128,
): BuildPart => ({
  id,
  slot: 'motherboard',
  name: `MB ${socket}`,
  price: 400,
  motherboard: { socket, ramType, ramSlots, maxRamGB, formFactor },
});
const ram = (
  id: number,
  type: Ram,
  modules = 2,
  capacityGB = 32,
): BuildPart => ({
  id,
  slot: 'ram',
  name: `RAM ${type}`,
  price: 200,
  ram: { type, modules, capacityGB },
});
const gpu = (id: number, tdpWatts: number): BuildPart => ({
  id,
  slot: 'gpu',
  name: 'GPU',
  price: 1500,
  gpu: { tdpWatts },
});
const psu = (id: number, wattage: number, formFactor = 'ATX'): BuildPart => ({
  id,
  slot: 'psu',
  name: 'PSU',
  price: 300,
  psu: { wattage, formFactor },
});
const pcCase = (
  id: number,
  supportedFormFactors: Format[],
  sfxOnly = false,
): BuildPart => ({
  id,
  slot: 'case',
  name: 'Case',
  price: 250,
  pcCase: { supportedFormFactors, sfxOnly },
});

describe('configurator compatibility', () => {
  it('only offers CPUs with the motherboard socket', () => {
    const build = { motherboard: board(1, 'AM5', 'DDR5') };
    expect(fits(cpu(10, 'AM5'), build)).toBe(true);
    expect(fits(cpu(11, 'AM4'), build)).toBe(false);
    expect(fits(cpu(12, 'LGA1700'), build)).toBe(false);
  });

  it('only offers RAM of the motherboard memory type', () => {
    const build = { motherboard: board(1, 'LGA1700', 'DDR4') };
    expect(fits(ram(20, 'DDR4'), build)).toBe(true);
    expect(fits(ram(21, 'DDR5'), build)).toBe(false);
  });

  it('only offers motherboards matching both the CPU and the RAM', () => {
    const build = { cpu: cpu(10, 'LGA1700'), ram: ram(20, 'DDR5') };
    expect(fits(board(1, 'LGA1700', 'DDR5'), build)).toBe(true);
    expect(fits(board(2, 'LGA1700', 'DDR4'), build)).toBe(false);
    expect(fits(board(3, 'AM5', 'DDR5'), build)).toBe(false);
  });

  it('narrows RAM by CPU socket when no motherboard is chosen yet', () => {
    expect(fits(ram(20, 'DDR4'), { cpu: cpu(10, 'AM5') })).toBe(false);
    expect(fits(ram(20, 'DDR4'), { cpu: cpu(10, 'LGA1700') })).toBe(true);
    expect(fits(ram(21, 'DDR5'), { cpu: cpu(10, 'LGA1700') })).toBe(true);
  });

  it('checks RAM slots and maximum capacity', () => {
    const build = { motherboard: board(1, 'AM5', 'DDR5', 'MINI_ITX', 2, 96) };
    expect(fits(ram(20, 'DDR5', 4, 64), build)).toBe(false);
    expect(fits(ram(21, 'DDR5', 2, 128), build)).toBe(false);
    expect(fits(ram(22, 'DDR5', 2, 64), build)).toBe(true);
  });

  it('matches motherboard and case form factors', () => {
    const atxBoard = { motherboard: board(1, 'AM5', 'DDR5', 'ATX') };
    expect(fits(pcCase(30, ['MICRO_ATX', 'MINI_ITX']), atxBoard)).toBe(false);
    expect(fits(pcCase(31, ['ATX', 'MICRO_ATX', 'MINI_ITX']), atxBoard)).toBe(
      true,
    );
  });

  it('requires an SFX power supply in SFX-only cases and rejects Flex ATX / TFX', () => {
    const small = { case: pcCase(30, ['MINI_ITX'], true) };
    expect(fits(psu(40, 750, 'ATX'), small)).toBe(false);
    expect(fits(psu(41, 750, 'SFX'), small)).toBe(true);
    expect(fits(psu(42, 500, 'TFX'), { case: pcCase(31, ['ATX']) })).toBe(
      false,
    );
  });

  it('sizes the power supply from CPU + GPU consumption', () => {
    const build = { cpu: cpu(10, 'AM5', 120), gpu: gpu(50, 450) };
    expect(powerBudget(build)).toEqual({
      estimatedWatts: 650,
      recommendedPsuWatts: 850,
    });
    expect(fits(psu(40, 750), build)).toBe(false);
    expect(fits(psu(41, 850), build)).toBe(true);
    // et inversement : une alimentation de 550 W masque les GPU trop gourmands
    const withPsu = { cpu: cpu(10, 'AM5', 120), psu: psu(40, 550) };
    expect(fits(gpu(51, 450), withPsu)).toBe(false);
    expect(fits(gpu(52, 145), withPsu)).toBe(true);
  });

  it('warns (without blocking) when the CPU has no integrated graphics and no GPU is chosen', () => {
    const result = evaluate({ cpu: cpu(10, 'LGA1700', 65, false) });
    expect(result.valid).toBe(true);
    expect(result.checks.find((c) => c.id === 'graphics')?.status).toBe(
      'warning',
    );
    const withGpu = evaluate({
      cpu: cpu(10, 'LGA1700', 65, false),
      gpu: gpu(50, 145),
    });
    expect(withGpu.checks.find((c) => c.id === 'graphics')?.status).toBe('ok');
  });

  const corePc = () => ({
    cpu: cpu(10, 'AM5', 105),
    motherboard: board(1, 'AM5', 'DDR5'),
    ram: ram(20, 'DDR5'),
    gpu: gpu(50, 263),
    storage: { id: 60, slot: 'storage' as const, name: 'SSD', price: 300 },
    psu: psu(40, 750),
    case: pcCase(30, ['ATX', 'MICRO_ATX', 'MINI_ITX']),
  });

  it('reports a complete, valid build', () => {
    const result = evaluate({
      ...corePc(),
      cooler: { id: 70, slot: 'cooler', name: 'Tower', price: 150 },
    });
    expect(result.valid).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.checks.every((c) => c.status === 'ok')).toBe(true);
  });

  it('treats the cooler and the peripherals as optional', () => {
    const result = evaluate(corePc());
    expect(result.complete).toBe(true);
    expect(result.checks.find((c) => c.id === 'cooling')?.status).toBe(
      'warning',
    );
  });

  it('does not require peripherals to fit anything', () => {
    const monitor: BuildPart = {
      id: 80,
      slot: 'monitor',
      name: 'Écran',
      price: 900,
    };
    expect(fits(monitor, corePc())).toBe(true);
  });

  it('flags an incompatible build as invalid', () => {
    const result = evaluate({
      cpu: cpu(10, 'AM4'),
      motherboard: board(1, 'AM5', 'DDR5'),
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((c) => c.id === 'socket')?.status).toBe('error');
  });

  it('writes its messages in the language of the request', () => {
    const build = { cpu: cpu(10, 'AM4'), motherboard: board(1, 'AM5', 'DDR5') };
    const socket = (lang: 'fr' | 'en') =>
      withLang(lang, () => evaluate(build)).checks.find(
        (c) => c.id === 'socket',
      )?.message;
    expect(socket('fr')).toBe(
      'Socket incompatible : processeur AM4, carte mère AM5',
    );
    expect(socket('en')).toBe(
      'Incompatible socket: processor AM4, motherboard AM5',
    );
    expect(parseLang('en-US,en;q=0.9')).toBe('en');
    expect(parseLang('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(parseLang(undefined)).toBe('fr');
  });
});
