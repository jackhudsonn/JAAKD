import { InjectionToken } from '@angular/core';
import { InstrumentType } from '@core/models';
import {
  MOCK_ASSETS,
  MOCK_TOP_LOSERS,
  MOCK_TOP_WINNERS,
  PERFORMANCE_INTERVALS,
  PerformanceInterval,
  getAsset,
  getMockPerformanceSeries,
  getMockPrice,
} from '@core/mocks/market-reference.mock';
import { LineChartPoint } from '@shared/components/line-chart/line-chart.component';

export interface DashboardMarketAsset {
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
  basePrice: number;
}

export interface DashboardMover {
  symbol: string;
  changeAmount: number;
  changePct: number;
}

export type DashboardPerformanceInterval = PerformanceInterval;

export interface DashboardMarketDataPort {
  readonly performanceIntervals: readonly {
    id: DashboardPerformanceInterval;
    label: string;
  }[];
  listAssets(): readonly DashboardMarketAsset[];
  getAsset(symbol: string): DashboardMarketAsset | undefined;
  getPrice(symbol: string): number;
  getPerformanceSeries(interval: DashboardPerformanceInterval): LineChartPoint[];
  getTopWinners(): readonly DashboardMover[];
  getTopLosers(): readonly DashboardMover[];
  isKnownSymbol(symbol: string): boolean;
}

export const DASHBOARD_MARKET_DATA_PORT = new InjectionToken<DashboardMarketDataPort>(
  'DASHBOARD_MARKET_DATA_PORT',
  {
    providedIn: 'root',
    factory: () => ({
      performanceIntervals: PERFORMANCE_INTERVALS,
      listAssets: () => MOCK_ASSETS,
      getAsset: (symbol: string) => getAsset(symbol),
      getPrice: (symbol: string) => getMockPrice(symbol),
      getPerformanceSeries: (interval: DashboardPerformanceInterval) =>
        getMockPerformanceSeries(interval),
      getTopWinners: () => MOCK_TOP_WINNERS,
      getTopLosers: () => MOCK_TOP_LOSERS,
      isKnownSymbol: (symbol: string) => MOCK_ASSETS.some((asset) => asset.symbol === symbol),
    }),
  },
);
