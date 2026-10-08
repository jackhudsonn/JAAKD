import { InstrumentType } from '@core/models';
import { LineChartPoint } from '@shared/components/line-chart/line-chart.component';

// TO BE DELETED: Temporary market/reference fixtures for phase-2 frontend API wiring.
// Replace with backend instrument, quote, and analytics endpoints during integration.

export interface MockAsset {
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
  basePrice: number;
  volatility: number;
}

export interface MockMover {
  symbol: string;
  changeAmount: number;
  changePct: number;
}

export type AssetPerformanceInterval = '1D' | '1W' | '1M' | '3M' | '1Y' | 'MAX';

export type PerformanceInterval = '1D' | '1W' | '1M' | 'YTD' | '1Y' | '5Y' | '10Y' | 'ALL';

export interface PerformancePoint {
  label: string;
  value: number;
}

export const MOCK_ASSETS: MockAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', instrumentType: 'crypto', basePrice: 61_200, volatility: 0.05 },
  { symbol: 'ETH', name: 'Ethereum', instrumentType: 'crypto', basePrice: 2_980, volatility: 0.06 },
  { symbol: 'ADA', name: 'Cardano', instrumentType: 'crypto', basePrice: 0.42, volatility: 0.08 },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    instrumentType: 'stock',
    basePrice: 118.6,
    volatility: 0.03,
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    instrumentType: 'stock',
    basePrice: 186.3,
    volatility: 0.02,
  },
  {
    symbol: 'IBM',
    name: 'IBM Corp.',
    instrumentType: 'stock',
    basePrice: 231.4,
    volatility: 0.015,
  },
  {
    symbol: 'GOVT',
    name: 'US Treasury 10-20yr Bond ETF',
    instrumentType: 'bond',
    basePrice: 24.1,
    volatility: 0.005,
  },
  {
    symbol: 'BND',
    name: 'Total Bond Market ETF',
    instrumentType: 'bond',
    basePrice: 72.8,
    volatility: 0.004,
  },
  {
    symbol: 'IONQ',
    name: 'IonQ Inc.',
    instrumentType: 'stock',
    basePrice: 18.75,
    volatility: 0.04,
  },
];

export const MOCK_TOP_WINNERS: MockMover[] = [
  { symbol: 'NVDA', changeAmount: 4.1, changePct: 3.58 },
  { symbol: 'BTC', changeAmount: 1_842.0, changePct: 3.11 },
  { symbol: 'IONQ', changeAmount: 0.97, changePct: 5.45 },
  { symbol: 'AAPL', changeAmount: 2.5, changePct: 1.1 },
  { symbol: 'TSLA', changeAmount: 3.2, changePct: 0.9 },
];

export const MOCK_TOP_LOSERS: MockMover[] = [
  { symbol: 'MSFT', changeAmount: -1.75, changePct: -0.42 },
  { symbol: 'AMD', changeAmount: -2.9, changePct: -2.14 },
  { symbol: 'GOOGL', changeAmount: -5.1, changePct: -1.8 },
  { symbol: 'AMZN', changeAmount: -3.2, changePct: -1.7 },
  { symbol: 'PLTR', changeAmount: -5.8, changePct: -1.5 },
];

export const MARKET_ORDER_PENDING_MS = 10_000;

export const ASSET_PERFORMANCE_INTERVALS: { id: AssetPerformanceInterval; label: string }[] = [
  { id: '1D', label: '1D' },
  { id: '1W', label: '1W' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '1Y', label: '1Y' },
  { id: 'MAX', label: 'MAX' },
];

export const PERFORMANCE_INTERVALS: { id: PerformanceInterval; label: string }[] = [
  { id: '1D', label: '1D' },
  { id: '1W', label: '1W' },
  { id: '1M', label: '1M' },
  { id: 'YTD', label: 'YTD' },
  { id: '1Y', label: '1Y' },
  { id: '5Y', label: '5Y' },
  { id: '10Y', label: '10Y' },
  { id: 'ALL', label: 'All' },
];

const ASSET_INTERVAL_CONFIG: Record<
  AssetPerformanceInterval,
  { points: number; labelEvery: number; labelUnit: string; amplitudeScale: number }
> = {
  '1D': { points: 24, labelEvery: 4, labelUnit: 'h', amplitudeScale: 0.012 },
  '1W': { points: 7, labelEvery: 1, labelUnit: 'd', amplitudeScale: 0.02 },
  '1M': { points: 30, labelEvery: 5, labelUnit: 'd', amplitudeScale: 0.03 },
  '3M': { points: 12, labelEvery: 2, labelUnit: 'w', amplitudeScale: 0.05 },
  '1Y': { points: 12, labelEvery: 2, labelUnit: 'mo', amplitudeScale: 0.07 },
  MAX: { points: 24, labelEvery: 4, labelUnit: 'mo', amplitudeScale: 0.11 },
};

const DASHBOARD_INTERVAL_CONFIG: Record<
  PerformanceInterval,
  { points: number; labelEvery: number; unit: string; baseline: number; amplitude: number }
> = {
  '1D': { points: 24, labelEvery: 4, unit: 'h', baseline: 10_000, amplitude: 0.02 },
  '1W': { points: 7, labelEvery: 1, unit: 'd', baseline: 10_050, amplitude: 0.03 },
  '1M': { points: 30, labelEvery: 5, unit: 'd', baseline: 10_100, amplitude: 0.04 },
  YTD: { points: 12, labelEvery: 1, unit: 'mo', baseline: 10_200, amplitude: 0.05 },
  '1Y': { points: 12, labelEvery: 1, unit: 'mo', baseline: 10_350, amplitude: 0.06 },
  '5Y': { points: 20, labelEvery: 4, unit: 'q', baseline: 10_700, amplitude: 0.08 },
  '10Y': { points: 20, labelEvery: 4, unit: 'q', baseline: 11_000, amplitude: 0.1 },
  ALL: { points: 24, labelEvery: 4, unit: 'q', baseline: 11_500, amplitude: 0.12 },
};

const assetSeriesCache = new Map<string, LineChartPoint[]>();
const dashboardSeriesCache = new Map<PerformanceInterval, PerformancePoint[]>();

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function symbolSeed(symbol: string): number {
  return symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function getAsset(symbol: string): MockAsset | undefined {
  return MOCK_ASSETS.find((asset) => asset.symbol === symbol);
}

export function getMockPrice(symbol: string): number {
  const asset = getAsset(symbol);
  return asset ? asset.basePrice : 0;
}

export function getMockAssetPerformanceSeries(
  symbol: string,
  interval: AssetPerformanceInterval,
): LineChartPoint[] {
  const cacheKey = `${symbol}:${interval}`;
  const cached = assetSeriesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const asset = getAsset(symbol);
  if (!asset) {
    return [];
  }

  const config = ASSET_INTERVAL_CONFIG[interval];
  const random = seededRandom(symbolSeed(symbol) * 31 + interval.length * 17);
  const series: LineChartPoint[] = [];

  let value = asset.basePrice;
  for (let i = config.points - 1; i >= 0; i--) {
    const delta = (random() - 0.5) * asset.basePrice * config.amplitudeScale;
    value = Math.max(0.01, value + delta);

    series.push({
      label: i === 0 ? 'now' : i % config.labelEvery === 0 ? `-${i}${config.labelUnit}` : '',
      value: Math.round(value * 100) / 100,
    });
  }

  assetSeriesCache.set(cacheKey, series);
  return series;
}

export function getMockPerformanceSeries(interval: PerformanceInterval): PerformancePoint[] {
  const cached = dashboardSeriesCache.get(interval);
  if (cached) {
    return cached;
  }

  const config = DASHBOARD_INTERVAL_CONFIG[interval];
  const random = seededRandom(interval.charCodeAt(0) * 31 + interval.length * 13);
  const series: PerformancePoint[] = [];

  let value = config.baseline;
  for (let i = 0; i < config.points; i++) {
    value += (random() - 0.48) * config.baseline * config.amplitude;
    series.push({
      label: i % config.labelEvery === 0 ? `${i}${config.unit}` : '',
      value: Math.round(value * 100) / 100,
    });
  }

  dashboardSeriesCache.set(interval, series);
  return series;
}
