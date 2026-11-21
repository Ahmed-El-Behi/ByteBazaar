import { localDay, periodBuckets, periodStart } from './dashboard.service';

describe('dashboard periods', () => {
  // 15 nov. 2026, 23 h 30 à Tunis (22 h 30 UTC)
  const now = new Date('2026-11-15T22:30:00Z');

  it('uses the Tunis calendar day', () => {
    expect(localDay(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-16');
    expect(localDay(now)).toBe('2026-11-15');
  });

  it('starts the period at midnight in Tunis, today included', () => {
    expect(periodStart(1, now).toISOString()).toBe('2026-11-14T23:00:00.000Z');
    expect(periodStart(7, now).toISOString()).toBe('2026-11-08T23:00:00.000Z');
  });

  it('lists every day of the period, even late in the evening', () => {
    const days = periodBuckets(periodStart(7, now), 7, 'day');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-09');
    expect(days[6]).toBe('2026-11-15');
  });

  it('groups a long period by month', () => {
    const months = periodBuckets(periodStart(365, now), 365, 'month');
    expect(months[0]).toBe('2025-11');
    expect(months.at(-1)).toBe('2026-11');
    expect(months).toHaveLength(13);
  });
});
