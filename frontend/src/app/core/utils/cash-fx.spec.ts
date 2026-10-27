import { describe, expect, it } from 'vitest';
import { QuoteResponse } from '@core/models/api.models';
import {
  convertAmountBetweenCurrencies,
  invertRate,
  toFxSymbol,
  toPositiveRate,
  toReceiveAmount,
} from './cash-fx';

const quote = (overrides: Partial<QuoteResponse>): QuoteResponse => ({
  symbol: 'FX:EURUSD',
  price: null,
  bid: null,
  ask: null,
  currency: 'USD',
  asOf: null,
  marketState: null,
  changePercent: null,
  ...overrides,
});

describe('toFxSymbol', () => {
  it('builds the Fauxnance FX symbol', () => {
    expect(toFxSymbol('EUR', 'USD')).toBe('FX:EURUSD');
  });
});

describe('toPositiveRate', () => {
  it('uses the price first', () => {
    expect(toPositiveRate(quote({ price: 1.08, bid: 1.07, ask: 1.09 }))).toBe(1.08);
  });

  it('falls back to the bid, then the ask', () => {
    expect(toPositiveRate(quote({ bid: 1.07, ask: 1.09 }))).toBe(1.07);
    expect(toPositiveRate(quote({ price: 0, ask: 1.09 }))).toBe(1.09);
  });

  it('returns null when there is no quote or no positive value', () => {
    expect(toPositiveRate(undefined)).toBeNull();
    expect(toPositiveRate(quote({}))).toBeNull();
    expect(toPositiveRate(quote({ price: -1, bid: 0 }))).toBeNull();
  });
});

describe('invertRate', () => {
  it('inverts a positive rate', () => {
    expect(invertRate(1.25)).toBeCloseTo(0.8);
  });

  it.each([null, 0, -2])('returns null for %s', (rate) => {
    expect(invertRate(rate)).toBeNull();
  });
});

describe('convertAmountBetweenCurrencies', () => {
  const rates = { USD: 1, EUR: 0.8, GBP: 0.5 };

  it('pivots through USD', () => {
    expect(convertAmountBetweenCurrencies(100, 'EUR', 'GBP', rates)).toBeCloseTo(62.5);
    expect(convertAmountBetweenCurrencies(100, 'USD', 'EUR', rates)).toBeCloseTo(80);
  });

  it('returns null when a required rate is unavailable', () => {
    expect(convertAmountBetweenCurrencies(100, 'EUR', 'INR', rates)).toBeNull();
  });
});

describe('toReceiveAmount', () => {
  it('multiplies the amount by the rate', () => {
    expect(toReceiveAmount(100, 1.08)).toBeCloseTo(108);
  });

  it.each([null, 0, -5, Number.NaN])('returns null for amount %s', (amount) => {
    expect(toReceiveAmount(amount, 1.08)).toBeNull();
  });

  it.each([null, 0])('returns null for rate %s', (rate) => {
    expect(toReceiveAmount(100, rate)).toBeNull();
  });
});
