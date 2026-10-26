import { CashCurrency } from '@core/models/api.models';

// Mock conversion rates relative to one USD.
export const CASH_RATES_BY_USD: Readonly<Record<CashCurrency, number>> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.2,
};

export const convertAmountBetweenCurrencies = (
  amount: number,
  fromCurrency: CashCurrency,
  toCurrency: CashCurrency,
): number => {
  const fromRate = CASH_RATES_BY_USD[fromCurrency];
  const toRate = CASH_RATES_BY_USD[toCurrency];
  const amountInUsd = amount / fromRate;
  return amountInUsd * toRate;
};
