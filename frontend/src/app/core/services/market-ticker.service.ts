import { Injectable } from '@angular/core';
import { CASH_CURRENCIES, type CashCurrency } from '@core/models/api.models';
import { toQuoteSymbols } from '@features/dashboard/services/dashboard-backend.mappers';
import { toDisplaySymbol } from '@shared/utils/display-format';
import { roundChangePct } from '@shared/utils/format-percentage-change';
import { InstrumentApiService } from './instrument-api.service';

export interface MarketTickerItem {
  symbol: string;
  price: number;
  currency: CashCurrency;
  changePct: number | null;
}

function toCashCurrency(value: string | null): CashCurrency | null {
  const normalized = value?.toUpperCase();
  return CASH_CURRENCIES.find((currency) => currency === normalized) ?? null;
}

@Injectable({
  providedIn: 'root',
})
export class MarketTickerService {
  constructor(private instrumentApiService: InstrumentApiService) {}

  async getTickerItems(): Promise<MarketTickerItem[]> {
    const symbols = toQuoteSymbols(await this.instrumentApiService.list());
    if (symbols.length === 0) {
      return [];
    }

    const items: MarketTickerItem[] = [];
    for (const quote of await this.instrumentApiService.getQuotes(symbols)) {
      if (quote.price !== null && quote.price > 0) {
        const currency = toCashCurrency(quote.currency);
        if (!currency) {
          console.warn(
            `Skipping market ticker quote ${quote.symbol}: unsupported or missing currency "${quote.currency}".`,
          );
          continue;
        }

        items.push({
          symbol: toDisplaySymbol(quote.symbol),
          price: quote.price,
          currency,
          changePct: quote.changePercent === null ? null : roundChangePct(quote.changePercent),
        });
      }
    }

    return items;
  }
}
