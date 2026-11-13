import { localProductName, translate } from './i18n';

describe('translate', () => {
  it('returns the French text unchanged in French', () => {
    expect(translate('Voir le catalogue', undefined, 'fr')).toBe('Voir le catalogue');
  });

  it('looks the text up in the English dictionary', () => {
    expect(translate('Voir le catalogue', undefined, 'en')).toBe('View the catalogue');
  });

  it('replaces parameters in both languages', () => {
    expect(translate('{n} produits', { n: 12 }, 'fr')).toBe('12 produits');
    expect(translate('{n} produits', { n: 12 }, 'en')).toBe('12 products');
  });

  it('falls back to French when a translation is missing', () => {
    expect(translate('Texte sans traduction', undefined, 'en')).toBe('Texte sans traduction');
  });
});

describe('localProductName', () => {
  it('keeps product names unchanged in French', () => {
    expect(localProductName('Razer Viper (Noir / Vert)', 'fr')).toBe('Razer Viper (Noir / Vert)');
  });

  it('translates the final colour in English', () => {
    expect(localProductName('Razer Viper (Noir / Vert)', 'en')).toBe('Razer Viper (Black / Green)');
  });

  it('leaves other parentheses untouched', () => {
    expect(localProductName('SteelSeries Apex 7 (Cherry MX Red)', 'en')).toBe(
      'SteelSeries Apex 7 (Cherry MX Red)',
    );
  });
});
