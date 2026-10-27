import { describe, expect, it } from 'vitest';
import {
  PerformanceInterval,
  filterByInterval,
  summarize,
  toChartLabel,
} from './performance-graph.util';

const dates = ['2025-06-01', '2025-12-31', '2026-01-02', '2026-09-25', '2026-10-13', '2026-10-20'];
const points = dates.map((date, i) => ({ date, value: i }));

describe('performance-graph util', () => {
  it.each<[PerformanceInterval, number]>([
    ['1W', 4],
    ['1M', 3],
    ['YTD', 2],
    ['1Y', 1],
    ['ALL', 0],
  ])('%s keeps the points back from the newest one', (interval, firstIndex) => {
    expect(filterByInterval(points, interval).map((point) => point.date)).toEqual(
      dates.slice(firstIndex),
    );
  });

  it('summarizes value, change, change % and range', () => {
    const values = [200, 260, 250].map((value) => ({ date: '2026-10-20', value }));
    expect(summarize(values)).toEqual({
      current: 250,
      change: 50,
      changePct: 25,
      high: 260,
      low: 200,
    });
    expect(summarize([{ date: '2026-10-20', value: 0 }])?.changePct).toBeNull();
    expect(summarize([])).toBeNull();
    expect(filterByInterval([], '1M')).toEqual([]);
    expect(toChartLabel('2026-10-20')).toBe('Oct 20');
  });
});
