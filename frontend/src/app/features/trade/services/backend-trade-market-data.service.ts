import { Injectable } from '@angular/core';
import {
  ASSET_PERFORMANCE_INTERVALS,
  MARKET_ORDER_PENDING_MS,
} from '@core/mocks/market-reference.mock';
import { toInstrumentType } from '@features/dashboard/services/dashboard-backend.mappers';
import { LineChartPoint } from '@shared/components/line-chart/line-chart.component';
import {
  TradeAssetPerformanceInterval,
  TradeMarketAsset,
  TradeMarketDataPort,
} from './trade-market-data.port';
import { BackendTradeStateService } from './backend-trade-state.service';

@Injectable({
  providedIn: 'root',
})
export class BackendTradeMarketDataService implements TradeMarketDataPort {
  readonly marketOrderPendingMs = MARKET_ORDER_PENDING_MS;
  readonly performanceIntervals = ASSET_PERFORMANCE_INTERVALS;

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

        const price = prices.get(instrument.ticker) ?? 0;
        // Quotes are filed under both "BTC" and "X:BTC-USD", so the ticker finds crypto either way.
        const changePct = liveQuotes.get(instrument.ticker.toUpperCase())?.changePct ?? null;

        return {
          symbol: instrument.ticker,
          name: instrument.name,
          currency: instrument.tradingCurrency,
          instrumentType,
          basePrice: this.toPreviousClose(price, changePct),
        };
      })
      .filter((asset): asset is TradeMarketAsset => asset !== null);
  }

  getAsset(symbol: string): TradeMarketAsset | undefined {
    return this.listAssets().find((asset) => asset.symbol === symbol);
  }

  getPrice(symbol: string): number {
    return this.backendTradeStateService.latestPriceBySymbolData().get(symbol) ?? 0;
  }

  getPerformanceSeries(
    _symbol: string,
    _interval: TradeAssetPerformanceInterval,
  ): LineChartPoint[] {
    return [];
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
