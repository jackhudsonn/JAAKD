import { Injectable } from '@angular/core';
import { toQuoteSymbols } from '@features/dashboard/services/dashboard-backend.mappers';
import { toDisplaySymbol } from '@shared/utils/display-symbol';
import { roundChangePct } from '@shared/utils/format-percentage-change';
import { InstrumentApiService } from './instrument-api.service';

export interface MarketTickerItem {
  symbol: string;
  price: number;
  changePct: number | null;
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
        items.push({
          symbol: toDisplaySymbol(quote.symbol),
          price: quote.price,
          changePct: quote.changePercent === null ? null : roundChangePct(quote.changePercent),
        });
      }
    }

    return items;
  }
}
