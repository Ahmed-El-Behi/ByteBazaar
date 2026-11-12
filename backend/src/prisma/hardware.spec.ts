import {
  cpuFromSpecs,
  gpuBoardPower,
  motherboardFromSpecs,
  pcCaseFromSpecs,
  ramFromSpecs,
} from './hardware';

const product = (
  categorySlug: string,
  name: string,
  specs: Record<string, string>,
  url = '',
) => ({
  categorySlug,
  name,
  specs: Object.entries(specs).map(([n, valueText]) => ({
    name: n,
    valueText,
  })),
  source: { url },
});

describe('hardware derivation', () => {
  it('derives the CPU socket from its microarchitecture', () => {
    const cpu = (micro: string) =>
      cpuFromSpecs(
        product('processeurs', 'x', {
          Microarchitecture: micro,
          'Core Count': '8',
          'Performance Core Clock': '4.2 GHz',
          TDP: '120 W',
          'Integrated Graphics': 'None',
        }),
      );
    expect(cpu('Zen 3')?.socket).toBe('AM4');
    expect(cpu('Zen 5')?.socket).toBe('AM5');
    expect(cpu('Raptor Lake Refresh')?.socket).toBe('LGA1700');
    expect(cpu('Arrow Lake')?.socket).toBe('LGA1851');
    expect(cpu('Zen 5')?.hasIntegratedGraphics).toBe(false);
  });

  it('derives the motherboard memory type, including LGA1700 DDR4 variants', () => {
    const mb = (name: string, socket: string) =>
      motherboardFromSpecs(
        product('cartes-meres', name, {
          'Socket / CPU': socket,
          'Form Factor': 'Micro ATX',
          'Memory Slots': '4',
          'Memory Max': '128 GB',
        }),
      );
    expect(mb('Gigabyte B650M DS3H', 'AM5')?.ramType).toBe('DDR5');
    expect(mb('MSI B550M PRO', 'AM4')?.ramType).toBe('DDR4');
    expect(mb('Asus PRIME B760M-A WIFI', 'LGA1700')?.ramType).toBe('DDR5');
    expect(mb('Asus PRIME B760M-A WIFI D4', 'LGA1700')?.ramType).toBe('DDR4');
    expect(mb('ASRock B760M-ITX/D4 WiFi', 'LGA1700')?.ramType).toBe('DDR4');
    expect(mb('MSI PRO B760M-P DDR4', 'LGA1700')?.ramType).toBe('DDR4');
    expect(mb('ASRock H610M-HDV/M.2+ D5', 'LGA1700')?.ramType).toBe('DDR5');
    expect(mb('ASRock H610M-HDV/M.2', 'LGA1700')?.ramType).toBe('DDR4');
    expect(mb('Gigabyte B650M DS3H', 'AM5')?.chipset).toBe('B650');
    expect(mb('ASRock Z890I Nova WiFi', 'LGA1851')?.chipset).toBe('Z890');
    expect(mb('NZXT N7-B85XT-W1', 'AM5')?.chipset).toBe('B850');
    expect(mb('ASRock H610M-ITX/eDP', 'LGA1700')).toBeNull(); // SO-DIMM
  });

  it('parses RAM kits and excludes laptop SO-DIMM', () => {
    expect(
      ramFromSpecs(
        product('memoire-ram', 'kit', {
          Speed: 'DDR5-6000',
          Modules: '2 x 16GB',
        }),
      ),
    ).toEqual({
      type: 'DDR5',
      speedMHz: 6000,
      modules: 2,
      capacityGB: 32,
    });
    const sodimm = product(
      'memoire-ram',
      'kit',
      { Speed: 'DDR5-5600', Modules: '2 x 64GB' },
      'https://x/ddr5-5600-sodimm-cl46',
    );
    expect(ramFromSpecs(sodimm)).toBeNull();
  });

  it('knows the board power of GPU chips', () => {
    expect(gpuBoardPower('GeForce RTX 4090')).toBe(450);
    expect(gpuBoardPower('GeForce RTX 3080 12GB LHR')).toBe(350);
    expect(gpuBoardPower('GeForce RTX 3080 10GB LHR')).toBe(320);
    expect(gpuBoardPower('GeForce RTX 3050 6GB')).toBe(70);
    expect(gpuBoardPower('Radeon RX 9070 XT')).toBe(304);
  });

  it('maps case types to supported motherboard formats', () => {
    const tower = pcCaseFromSpecs(
      product('boitiers', 'Lian Li LANCOOL III', { Type: 'ATX Mid Tower' }),
    );
    expect(tower?.supportedFormFactors).toEqual([
      'ATX',
      'MICRO_ATX',
      'MINI_ITX',
    ]);
    expect(
      pcCaseFromSpecs(
        product('boitiers', 'Fractal Design Ridge PCIe 4.0', {
          Type: 'Mini ITX Tower',
        }),
      ),
    ).toEqual({
      supportedFormFactors: ['MINI_ITX'],
      maxGpuLengthMm: null,
      sfxOnly: true,
    });
    expect(
      pcCaseFromSpecs(
        product('boitiers', 'Silverstone GD09B', { Type: 'HTPC' }),
      )?.supportedFormFactors,
    ).toContain('ATX');
  });
});
