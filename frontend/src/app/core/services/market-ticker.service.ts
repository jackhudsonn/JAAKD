import { Injectable } from '@angular/core';
import type { InstrumentType } from '@core/models';
import { CASH_CURRENCIES, type CashCurrency } from '@core/models/api.models';
import {
  toInstrumentType,
  toQuoteSymbol,
} from '@features/dashboard/services/dashboard-backend.mappers';
import { toDisplaySymbol } from '@shared/utils/display-format';
import { roundChangePct } from '@shared/utils/format-percentage-change';
import { InstrumentApiService } from './instrument-api.service';

export interface MarketTickerItem {
  ticker: string;
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
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
    const instruments = await this.instrumentApiService.list();
    const quoteInstruments = instruments.flatMap((instrument) => {
      const instrumentType = toInstrumentType(instrument.instrumentClass);
      return instrumentType
        ? [{ instrument, instrumentType, quoteSymbol: toQuoteSymbol(instrument) }]
        : [];
    });
    if (quoteInstruments.length === 0) {
      return [];
    }

    const instrumentByQuoteSymbol = new Map(
      quoteInstruments.map((entry) => [entry.quoteSymbol.toUpperCase(), entry]),
    );
    const symbols = quoteInstruments.map((entry) => entry.quoteSymbol);
    const items: MarketTickerItem[] = [];

    for (const quote of await this.instrumentApiService.getQuotes(symbols)) {
      const matched = instrumentByQuoteSymbol.get(quote.symbol.toUpperCase());
      if (!matched || quote.price === null || quote.price <= 0) {
        continue;
      }

      const currency = toCashCurrency(quote.currency);
      if (!currency) {
        console.warn(
          `Skipping market ticker quote ${quote.symbol}: unsupported or missing currency "${quote.currency}".`,
        );
        continue;
      }

      items.push({
        ticker: matched.instrument.ticker,
        symbol: toDisplaySymbol(matched.instrument.ticker),
        name: matched.instrument.name,
        instrumentType: matched.instrumentType,
        price: quote.price,
        currency,
        changePct: quote.changePercent === null ? null : roundChangePct(quote.changePercent),
      });
    }

    return items;
  }
}
