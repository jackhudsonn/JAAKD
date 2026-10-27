import { CashCurrency, QuoteResponse } from '@core/models/api.models';

/** Currency rates expressed as units of each currency per one USD. */
export type CashRatesByUsd = Readonly<Partial<Record<CashCurrency, number>>>;

export const USD_RATES_BY_USD: CashRatesByUsd = { USD: 1 };

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

export function convertAmountBetweenCurrencies(
  amount: number,
  fromCurrency: CashCurrency,
  toCurrency: CashCurrency,
  rates: CashRatesByUsd,
): number | null {
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (fromRate === undefined || fromRate <= 0 || toRate === undefined || toRate <= 0) {
    return null;
  }

  return (amount / fromRate) * toRate;
}
