import { CashCurrency, QuoteResponse } from '@core/models/api.models';

export function toFxSymbol(base: CashCurrency, quote: CashCurrency): string {
  return `FX:${base}${quote}`;
}

// Same order as the backend's HoldingService.resolvePositiveRate: price, then bid, then ask.
export function toPositiveRate(quote: QuoteResponse | undefined): number | null {
  if (!quote) {
    return null;
  }

  for (const value of [quote.price, quote.bid, quote.ask]) {
    if (value !== null && value > 0) {
      return value;
    }
  }

  return null;
}

export function invertRate(rate: number | null): number | null {
  return rate !== null && rate > 0 ? 1 / rate : null;
}

export function toReceiveAmount(amount: number | null, rate: number | null): number | null {
  if (amount === null || !Number.isFinite(amount) || amount <= 0 || rate === null || rate <= 0) {
    return null;
  }

  return amount * rate;
}
