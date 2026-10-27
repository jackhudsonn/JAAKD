import { describe, expect, it } from 'vitest';
import { PerformanceInterval, filterByInterval, summarize } from './performance-graph.util';

const dates = ['2025-06-01', '2025-12-31', '2026-01-02', '2026-09-25', '2026-10-13', '2026-10-20'];

describe('performance-graph util', () => {
  it.each<[PerformanceInterval, number]>([
    ['1W', 4],
    ['1M', 3],
    ['YTD', 2],
    ['1Y', 1],
    ['ALL', 0],
  ])('%s keeps the points back from the newest one', (interval, firstIndex) => {
    const points = dates.map((date, i) => ({ date, value: i }));
    expect(filterByInterval(points, interval).map((point) => point.date)).toEqual(
      dates.slice(firstIndex),
    );
  });

  it('gives high, low and change', () => {
    const points = [200, 260, 250].map((value) => ({ date: '2026-10-20', value }));
    expect(summarize(points)).toMatchObject({ high: 260, low: 200, change: 50, changePct: 25 });
  });
});
