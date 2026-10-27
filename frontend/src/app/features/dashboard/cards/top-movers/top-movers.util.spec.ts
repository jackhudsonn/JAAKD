import { describe, expect, it } from 'vitest';
import { LiveQuote } from '@features/dashboard/services/dashboard-backend.mappers';
import { toChangeAmount, toTopMovers } from './top-movers.util';

const quotes = (entries: [string, number, number | null][]): Map<string, LiveQuote> =>
  new Map(
    entries.map(([symbol, price, changePct]) => [symbol, { price, changePct, currency: 'USD' }]),
  );

describe('toChangeAmount', () => {
  it('derives the amount from the previous close', () => {
    expect(toChangeAmount(110, 10)).toBeCloseTo(10);
    expect(toChangeAmount(90, -10)).toBeCloseTo(-10);
  });

  it('returns 0 for no change', () => {
    expect(toChangeAmount(100, 0)).toBe(0);
  });
});

describe('toTopMovers', () => {
  const live = quotes([
    ['AAPL', 110, 10],
    ['MSFT', 90, -10],
    ['NVDA', 103, 3],
    ['AMD', 98, -2],
    ['IBM', 100, 0],
    ['TSLA', 100, null],
  ]);

  it('ranks winners by largest percent gain', () => {
    expect(toTopMovers(live, true).map((mover) => mover.symbol)).toEqual(['AAPL', 'NVDA']);
  });

  it('ranks losers by largest percent loss', () => {
    expect(toTopMovers(live, false).map((mover) => mover.symbol)).toEqual(['MSFT', 'AMD']);
  });

  it('includes the derived change amount', () => {
    const [aapl] = toTopMovers(live, true);

    expect(aapl.changePct).toBe(10);
    expect(aapl.changeAmount).toBeCloseTo(10);
  });

  it('shows crypto once under its display symbol', () => {
    const btc: LiveQuote = { price: 105, changePct: 5, currency: 'USD' };
    const crypto = new Map<string, LiveQuote>([
      ['X:BTC-USD', btc],
      ['BTC', btc],
    ]);

    expect(toTopMovers(crypto, true).map((mover) => mover.symbol)).toEqual(['BTC']);
  });

  it('limits the number of rows', () => {
    const many = quotes([
      ['A', 101, 1],
      ['B', 102, 2],
      ['C', 103, 3],
    ]);

    expect(toTopMovers(many, true, 2).map((mover) => mover.symbol)).toEqual(['C', 'B']);
  });

  it('returns no rows when there are no quotes or no moves', () => {
    expect(toTopMovers(new Map(), true)).toEqual([]);
    expect(toTopMovers(quotes([['IBM', 100, 0]]), false)).toEqual([]);
  });
});
