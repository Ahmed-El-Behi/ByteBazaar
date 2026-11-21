import { filterCounts, filterWhere, searchWhere } from './order-filters';

describe('Filtres de la page Commandes (administration)', () => {
  it('« À traiter » regroupe les commandes en attente, confirmées et en préparation', () => {
    expect(filterWhere('a-traiter')).toEqual({
      status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] },
    });
    expect(filterWhere('toutes')).toEqual({});
  });

  it('« Virements en attente » exclut les commandes annulées', () => {
    expect(filterWhere('virements')).toEqual({
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'PENDING',
      status: { not: 'CANCELLED' },
    });
  });

  it('compte chaque filtre à partir des statuts', () => {
    const counts = filterCounts(
      [
        { status: 'PENDING', count: 2 },
        { status: 'PREPARING', count: 3 },
        { status: 'SHIPPED', count: 4 },
        { status: 'DELIVERED', count: 10 },
        { status: 'CANCELLED', count: 1 },
      ],
      2,
    );
    expect(counts).toEqual({
      toutes: 20,
      'a-traiter': 5,
      expediees: 4,
      livrees: 10,
      annulees: 1,
      virements: 2,
    });
  });

  it('recherche : un critère par mot, vide sans texte', () => {
    expect(searchWhere('   ')).toEqual([]);
    const where = searchWhere(' Sami  BB-12 ');
    expect(where).toHaveLength(2);
    expect(JSON.stringify(where[0])).toContain('"contains":"Sami"');
    expect(JSON.stringify(where[1])).toContain('"contains":"BB-12"');
  });
});
