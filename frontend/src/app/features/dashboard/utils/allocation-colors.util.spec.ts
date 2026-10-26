import { describe, expect, it } from 'vitest';
import { deterministicColorFromBase } from './allocation-colors.util';

describe('deterministicColorFromBase', () => {
  it('returns stable colors for the same key', () => {
    const first = deterministicColorFromBase('#3498DB', 'AAPL');
    const second = deterministicColorFromBase('#3498DB', 'AAPL');

    expect(first).toBe(second);
  });

  it('returns different shades for different keys under the same base color', () => {
    const aapl = deterministicColorFromBase('#3498DB', 'AAPL');
    const msft = deterministicColorFromBase('#3498DB', 'MSFT');

    expect(aapl).not.toBe(msft);
  });

  it('preserves invalid hex values unchanged', () => {
    expect(deterministicColorFromBase('invalid-color', 'AAPL')).toBe('invalid-color');
  });
});
