import { formatPercentageChange, isFlatChange, roundChangePct } from './format-percentage-change';

describe('formatPercentageChange', () => {
  it('shows gains with a plus sign and an up arrow', () => {
    expect(formatPercentageChange(1.844)).toBe('+1.84% ↑');
  });

  it('shows losses with a minus sign and a down arrow', () => {
    expect(formatPercentageChange(-0.756)).toBe('-0.76% ↓');
  });

  it('shows a change that rounds to zero without a sign', () => {
    expect(formatPercentageChange(-0.003)).toBe('0.00%');
    expect(formatPercentageChange(0.004)).toBe('0.00%');
    expect(formatPercentageChange(0)).toBe('0.00%');
  });
});

describe('isFlatChange', () => {
  it.each([0, 0.004, -0.004])('treats %s as flat', (value) => {
    expect(isFlatChange(value)).toBe(true);
  });

  it.each([0.005, -0.006, 1.5, -2])('does not treat %s as flat', (value) => {
    expect(isFlatChange(value)).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('does not treat %s as flat', (value) => {
    expect(isFlatChange(value)).toBe(false);
  });
});

describe('roundChangePct', () => {
  it('rounds to 2 decimals and never returns -0', () => {
    expect(roundChangePct(1.846)).toBe(1.85);
    expect(Object.is(roundChangePct(-0.003), 0)).toBe(true);
  });
});
