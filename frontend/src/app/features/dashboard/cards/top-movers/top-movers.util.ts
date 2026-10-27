import { LiveQuote } from '@features/dashboard/services/dashboard-backend.mappers';
import { DashboardMover } from '@features/dashboard/services/dashboard-market-data.port';
import { toDisplaySymbol } from '@shared/utils/display-format';

export const TOP_MOVERS_LIMIT = 5;

// Quotes only carry a percent change, so the amount is worked back from the previous close.
export function toChangeAmount(price: number, changePct: number): number {
  return price - price / (1 + changePct / 100);
}

export function toTopMovers(
  liveQuotes: ReadonlyMap<string, LiveQuote>,
  positive: boolean,
  limit = TOP_MOVERS_LIMIT,
): DashboardMover[] {
  // Crypto quotes are filed under both "BTC" and "X:BTC-USD"; keep one row per display symbol.
  const bySymbol = new Map<string, DashboardMover>();

  for (const [key, quote] of liveQuotes) {
    const changePct = quote.changePct;
    if (changePct === null || changePct <= -100) {
      continue;
    }
    if (positive ? changePct <= 0 : changePct >= 0) {
      continue;
    }

    const symbol = toDisplaySymbol(key);
    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, {
        symbol,
        currency: quote.currency,
        changeAmount: toChangeAmount(quote.price, changePct),
        changePct,
      });
    }
  }

  return [...bySymbol.values()]
    .sort((a, b) => (positive ? b.changePct - a.changePct : a.changePct - b.changePct))
    .slice(0, limit);
}
