import type { CashCurrency } from '@core/models/api.models';
import { formatCurrency, toDisplaySymbol } from './display-format';

describe('toDisplaySymbol', () => {
  it('removes the provider prefix and quote currency from crypto symbols', () => {
    expect(toDisplaySymbol('X:ETH-USD')).toBe('ETH');
  });

  it('removes the NSE suffix from display symbols', () => {
    expect(toDisplaySymbol('RELIANCE.NS')).toBe('RELIANCE');
  });

  it('leaves non-crypto symbols unchanged', () => {
    expect(toDisplaySymbol('AAPL')).toBe('AAPL');
    expect(toDisplaySymbol('FX:EURUSD')).toBe('FX:EURUSD');
  });
});

describe('formatCurrency', () => {
  it.each([
    [1234.5, 'USD', '$1,234.50'],
    ['1234.5', 'EUR', '€1,234.50'],
    [1234.5, 'GBP', '£1,234.50'],
    ['1234.5', 'INR', '₹1,234.50'],
  ] as const)('formats %s as %s currency', (value, currency, expected) => {
    expect(formatCurrency(value, currency)).toBe(expected);
  });

  it('rejects empty or non-numeric strings', () => {
    expect(() => formatCurrency('', 'USD')).toThrow(TypeError);
    expect(() => formatCurrency('not a number', 'USD')).toThrow(TypeError);
  });
});
