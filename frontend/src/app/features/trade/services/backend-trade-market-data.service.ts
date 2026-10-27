import { Injectable } from '@angular/core';
import { toInstrumentType } from '@features/dashboard/services/dashboard-backend.mappers';
import { TradeMarketAsset, TradeMarketDataPort } from './trade-market-data.port';
import { BackendTradeStateService } from './backend-trade-state.service';

@Injectable({
  providedIn: 'root',
})
export class BackendTradeMarketDataService implements TradeMarketDataPort {
  constructor(private backendTradeStateService: BackendTradeStateService) {}

  listAssets(): readonly TradeMarketAsset[] {
    const prices = this.backendTradeStateService.latestPriceBySymbolData();
    const liveQuotes = this.backendTradeStateService.liveQuoteBySymbolData();

    return this.backendTradeStateService
      .instrumentsData()
      .map((instrument) => {
        const instrumentType = toInstrumentType(instrument.instrumentClass);
        if (!instrumentType) {
          return null;
        }

        const price = prices.get(instrument.ticker) ?? null;
        // Quotes are filed under both "BTC" and "X:BTC-USD", so the ticker finds crypto either way.
        const changePct = liveQuotes.get(instrument.ticker.toUpperCase())?.changePct ?? null;

        return {
          symbol: instrument.ticker,
          name: instrument.name,
          currency: instrument.tradingCurrency,
          instrumentType,
          basePrice: price === null ? null : this.toPreviousClose(price, changePct),
        };
      })
      .filter((asset): asset is TradeMarketAsset => asset !== null);
  }

  getAsset(symbol: string): TradeMarketAsset | undefined {
    return this.listAssets().find((asset) => asset.symbol === symbol);
  }

  getPrice(symbol: string): number | null {
    return this.backendTradeStateService.latestPriceBySymbolData().get(symbol) ?? null;
  }

  isKnownSymbol(symbol: string): boolean {
    return this.listAssets().some((asset) => asset.symbol === symbol);
  }

  // basePrice is what the cards and popup measure the change against, so the
  // previous close makes them show the quote's daily change.
  private toPreviousClose(price: number, changePct: number | null): number {
    if (changePct === null || changePct <= -100) {
      return price;
    }

    return price / (1 + changePct / 100);
  }
}
