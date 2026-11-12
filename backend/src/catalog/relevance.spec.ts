import { relevanceOrder, type RelevanceCandidate } from './relevance';

const product = (
  id: number,
  name: string,
  categoryId: number,
  popularity = 0,
  stockQuantity = 5,
): RelevanceCandidate => ({
  id,
  name,
  sku: `PCP-${id}`,
  popularity,
  stockQuantity,
  categoryId,
  brand: { name: name.split(' ')[0] },
});

describe('relevanceOrder', () => {
  const day = Date.UTC(2026, 10, 12);

  it('mixes categories instead of listing one category in a block', () => {
    const catalogue = [
      ...Array.from({ length: 20 }, (_, i) =>
        product(i + 1, `Cooler ${i}`, 1, i),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        product(i + 101, `Gpu ${i}`, 2, i),
      ),
    ];
    const firstPage = relevanceOrder(catalogue, '', day).slice(0, 12);
    const gpus = firstPage.filter((id) => id > 100).length;
    expect(gpus).toBeGreaterThan(2);
    expect(gpus).toBeLessThan(10);
  });

  it('is stable within a day and varies between days', () => {
    const catalogue = Array.from({ length: 50 }, (_, i) =>
      product(i + 1, `Item ${i}`, 1 + (i % 3)),
    );
    expect(relevanceOrder(catalogue, '', day)).toEqual(
      relevanceOrder(catalogue, '', day + 3_600_000),
    );
    expect(relevanceOrder(catalogue, '', day)).not.toEqual(
      relevanceOrder(catalogue, '', day + 86_400_000),
    );
  });

  it('ranks the best text match first when searching', () => {
    const catalogue = [
      product(1, 'MSI GeForce RTX 4070 VENTUS 2X 12 GB', 2, 0),
      product(2, 'MSI GeForce RTX 4070 Ti GAMING X 12 GB', 2, 1000),
      product(3, 'Gigabyte GeForce RTX 5070 EAGLE 12 GB', 2, 5000),
    ];
    expect(relevanceOrder(catalogue, 'rtx 4070 ventus', day)[0]).toBe(1);
  });

  it('pushes out-of-stock products down at equal popularity', () => {
    const catalogue = Array.from({ length: 30 }, (_, i) =>
      product(i + 1, `Item ${i}`, 1, 10, i < 15 ? 0 : 5),
    );
    const top = relevanceOrder(catalogue, '', day).slice(0, 10);
    expect(top.filter((id) => id > 15).length).toBeGreaterThanOrEqual(7);
  });
});
