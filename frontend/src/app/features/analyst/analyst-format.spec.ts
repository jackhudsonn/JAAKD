import {
  CLASS_COLORS,
  classForLabel,
  classSlices,
  formatPercent,
  formatShare,
  formatUsd,
  rangeFor,
  rebaseCumulative,
  sortRows,
  topSlices,
} from './analyst-format';

describe('analyst-format', () => {
  describe('classSlices', () => {
    it('makes one slice per class with value, biggest first', () => {
      const slices = classSlices([
        { instrumentClass: 'CASH', value: 100 },
        { instrumentClass: 'EQUITY', value: 500 },
        { instrumentClass: 'CRYPTO', value: 0 },
        { instrumentClass: 'FX', value: null },
      ]);

      expect(slices).toEqual([
        { label: 'Equity', value: 500, color: CLASS_COLORS.EQUITY },
        { label: 'Cash', value: 100, color: CLASS_COLORS.CASH },
      ]);
    });
  });

  describe('topSlices', () => {
    const items = (values: number[]) =>
      values.map((value, index) => ({ ticker: `T${index}`, value }));
    const slicesFor = (values: number[]) =>
      topSlices(
        items(values),
        (item) => item.ticker,
        (item) => item.value,
        'EQUITY',
      );

    it('shows the top 4 by name and groups the rest as Other', () => {
      const slices = slicesFor([10, 60, 50, 40, 30, 20]);

      expect(slices.map((slice) => slice.label)).toEqual(['T1', 'T2', 'T3', 'T4', 'Other (2)']);
      expect(slices.at(-1)!.value).toBe(30);
    });

    it('names a fifth item instead of hiding it in an Other of one', () => {
      expect(slicesFor([50, 40, 30, 20, 10]).map((slice) => slice.label)).toEqual([
        'T0',
        'T1',
        'T2',
        'T3',
        'T4',
      ]);
    });

    it('leaves out items worth nothing', () => {
      expect(slicesFor([10, 0]).map((slice) => slice.label)).toEqual(['T0']);
    });

    it('colours the biggest slice in the class colour and the rest in lighter shades', () => {
      const [first, second] = slicesFor([20, 10]);

      expect(first.color).toBe(CLASS_COLORS.EQUITY.toLowerCase());
      expect(second.color).not.toBe(first.color);
    });
  });

  it('finds a class by its label, for clicks on class slices', () => {
    expect(classForLabel('Crypto')).toBe('CRYPTO');
    expect(classForLabel('AAPL')).toBeUndefined();
  });

  describe('sortRows', () => {
    const rows = [{ value: 2 }, { value: null }, { value: 3 }, { value: 1 }];

    it('sorts numbers either way, with missing values last', () => {
      expect(sortRows(rows, (row) => row.value, 'asc').map((row) => row.value)).toEqual([
        1,
        2,
        3,
        null,
      ]);
      expect(sortRows(rows, (row) => row.value, 'desc').map((row) => row.value)).toEqual([
        3,
        2,
        1,
        null,
      ]);
    });

    it('sorts text alphabetically and leaves the input untouched', () => {
      const names = [{ name: 'beta' }, { name: 'Alpha' }];

      expect(sortRows(names, (row) => row.name, 'asc').map((row) => row.name)).toEqual([
        'Alpha',
        'beta',
      ]);
      expect(names[0].name).toBe('beta');
    });
  });

  it('rebases cumulative returns to 0% on the first day with a value', () => {
    const points = rebaseCumulative([
      { date: '2026-10-20', value: null },
      { date: '2026-10-21', value: 0.1 },
      { date: '2026-10-22', value: 0.21 },
    ]);

    expect(points.map((point) => point.label)).toEqual(['Oct 21', 'Oct 22']);
    expect(points.map((point) => point.tooltipLabel)).toEqual(['Oct 21, 2026', 'Oct 22, 2026']);
    expect(points[0].value).toBe(0);
    expect(points[1].value).toBeCloseTo(0.1);
  });

  it('turns a range option into from/to dates', () => {
    const today = new Date(2026, 9, 26);

    expect(rangeFor('1M', today)).toEqual({ from: '2026-09-26', to: '2026-10-26' });
    expect(rangeFor('YTD', today)).toEqual({ from: '2026-01-01', to: '2026-10-26' });
    expect(rangeFor('5Y', today)).toEqual({ from: '2021-10-26', to: '2026-10-26' });
  });

  it('shows missing values as a dash, never as zero', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatShare(null)).toBe('—');
  });

  it('signs returns but not shares', () => {
    expect(formatPercent(0.0512)).toBe('+5.12%');
    expect(formatShare(0.723)).toBe('72.3%');
  });
});
