import { InjectionToken } from '@angular/core';
import { InstrumentType } from '@core/models';
import {
  ASSET_PERFORMANCE_INTERVALS,
  AssetPerformanceInterval,
  MARKET_ORDER_PENDING_MS,
  MOCK_ASSETS,
  getAsset,
  getMockAssetPerformanceSeries,
  getMockPrice,
} from '@core/mocks/mock-data';
import { LineChartPoint } from '@shared/components/line-chart/line-chart.component';

export interface TradeMarketAsset {
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
  basePrice: number;
}

export interface TradeMarketDataPort {
  readonly marketOrderPendingMs: number;
  readonly performanceIntervals: readonly { id: TradeAssetPerformanceInterval; label: string }[];
  listAssets(): readonly TradeMarketAsset[];
  getAsset(symbol: string): TradeMarketAsset | undefined;
  getPrice(symbol: string): number;
  getPerformanceSeries(
    symbol: string,
    interval: TradeAssetPerformanceInterval,
  ): LineChartPoint[];
  isKnownSymbol(symbol: string): boolean;
}

export type TradeAssetPerformanceInterval = AssetPerformanceInterval;

export const TRADE_MARKET_DATA_PORT = new InjectionToken<TradeMarketDataPort>(
  'TRADE_MARKET_DATA_PORT',
  {
    providedIn: 'root',
    factory: () => ({
      marketOrderPendingMs: MARKET_ORDER_PENDING_MS,
      performanceIntervals: ASSET_PERFORMANCE_INTERVALS,
      listAssets: () => MOCK_ASSETS,
      getAsset: (symbol: string) => getAsset(symbol),
      getPrice: (symbol: string) => getMockPrice(symbol),
      getPerformanceSeries: (symbol: string, interval: TradeAssetPerformanceInterval) =>
        getMockAssetPerformanceSeries(symbol, interval),
      isKnownSymbol: (symbol: string) => MOCK_ASSETS.some((asset) => asset.symbol === symbol),
    }),
  },
);
