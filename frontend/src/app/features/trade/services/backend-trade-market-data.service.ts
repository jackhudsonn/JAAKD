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

    return this.backendTradeStateService
      .instrumentsData()
      .map((instrument) => {
        const instrumentType = toInstrumentType(instrument.instrumentClass);
        if (!instrumentType) {
          return null;
        }

        return {
          symbol: instrument.ticker,
          name: instrument.name,
          instrumentType,
          basePrice: prices.get(instrument.ticker) ?? 0,
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
}
