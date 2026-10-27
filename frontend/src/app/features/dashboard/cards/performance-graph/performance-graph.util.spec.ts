import { describe, expect, it } from 'vitest';
import { filterByInterval, summarize, toChartLabel } from './performance-graph.util';

const dates = ['2025-06-01', '2025-12-31', '2026-01-02', '2026-09-25', '2026-10-13', '2026-10-20'];
const points = dates.map((date, i) => ({ date, value: i }));

describe('performance-graph util', () => {
  it('filters each interval back from the newest point', () => {
    const datesFor = (interval: Parameters<typeof filterByInterval>[1]) =>
      filterByInterval(points, interval).map((point) => point.date);
    expect(datesFor('1W')).toEqual(dates.slice(4));
    expect(datesFor('1M')).toEqual(dates.slice(3));
    expect(datesFor('YTD')).toEqual(dates.slice(2));
    expect(datesFor('1Y')).toEqual(dates.slice(1));
    expect(datesFor('ALL')).toEqual(dates);
    expect(filterByInterval([], '1M')).toEqual([]);
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
    expect(toChartLabel('2026-10-20')).toBe('Oct 20');
  });
});
