import { describe, expect, it } from 'vitest';
import { formatChartAxisDate, formatChartTooltipDate, toDateChartPoints } from './chart-date-label';

describe('chart date labels', () => {
  it('omits the year from axis labels inside one calendar year', () => {
    expect(formatChartAxisDate('2026-10-20', false)).toBe('Oct 20');
  });

  it('adds an abbreviated year to axis labels that span years', () => {
    expect(formatChartAxisDate('2025-10-20', true)).toBe("Oct '25");
  });

  it('always includes the full year in tooltip labels', () => {
    expect(formatChartTooltipDate('2026-10-20')).toBe('Oct 20, 2026');
  });

  it('formats dates in UTC so they never shift a day', () => {
    expect(formatChartAxisDate('2026-01-01', false)).toBe('Jan 1');
    expect(formatChartTooltipDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('uses the actual plotted span to decide whether to show years', () => {
    const points = toDateChartPoints([
      { date: '2025-10-20', value: 100 },
      { date: '2026-10-20', value: 110 },
    ]);

    expect(points).toEqual([
      { label: "Oct '25", tooltipLabel: 'Oct 20, 2025', value: 100 },
      { label: "Oct '26", tooltipLabel: 'Oct 20, 2026', value: 110 },
    ]);
  });

  it('keeps short labels when the data stays within one year', () => {
    const points = toDateChartPoints([
      { date: '2026-03-04', value: 102 },
      { date: '2026-10-20', value: 110 },
    ]);

    expect(points.map((point) => point.label)).toEqual(['Mar 4', 'Oct 20']);
    expect(points.map((point) => point.tooltipLabel)).toEqual(['Mar 4, 2026', 'Oct 20, 2026']);
  });
});
