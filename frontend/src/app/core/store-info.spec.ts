import { VAT_RATE, vatBreakdown } from './store-info';

describe('vatBreakdown', () => {
  it('splits a price including VAT into net amount and VAT', () => {
    const { ht, vat } = vatBreakdown(1190);
    expect(ht).toBe(1000);
    expect(vat).toBe(190);
  });

  it('rounds to the millime and keeps the total exact', () => {
    const total = 5517;
    const { ht, vat } = vatBreakdown(total);
    expect(ht).toBe(4636.134);
    expect(vat).toBe(880.866);
    expect(Math.round((ht + vat) * 1000) / 1000).toBe(total);
  });

  it('uses the Tunisian standard rate for IT equipment', () => {
    expect(VAT_RATE).toBe(0.19);
  });
});
