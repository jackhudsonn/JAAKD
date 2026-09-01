// Centralised mock data for all dashboard widgets.
// TODO: replace every export below with calls into real services
// (e.g. PortfolioService, OrdersService, MarketDataService) once the
// Spring Boot API + Kafka market feed are available.

export interface MockOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'partially_filled';
}

export interface MockWatchlistItem {
  symbol: string;
  price: number;
  changePct: number;
}

export interface MockMover {
  symbol: string;
  changeAmount: number;
  changePct: number;
}

export interface MockAllocationSlice {
  label: string;
  value: number;
  color: string;
}

// --- Portfolio Value -------------------------------------------------

// TODO: source from account balance + real-time position valuation endpoints.
export const MOCK_PORTFOLIO_VALUE = {
  cash: 12_430.55,
  assets: 48_912.10,
  get total() {
    return this.cash + this.assets;
  },
};

// --- Returns -----------------------------------------------------------

// TODO: source from a performance/analytics endpoint (all-time + daily P&L).
export const MOCK_RETURNS = {
  allTime: 9_284.32,
  daily: 182.47,
};

// --- Open Orders ---------------------------------------------------------

// TODO: source from OrdersService (GET /orders?status=open), and wire the
// cancel action to DELETE /orders/{id}.
export const MOCK_OPEN_ORDERS: MockOrder[] = [
  { id: 'ord-1', symbol: 'AAPL', side: 'buy', quantity: 10, price: 228.4, status: 'pending' },
  { id: 'ord-2', symbol: 'BTC', side: 'sell', quantity: 0.25, price: 61_200, status: 'pending' },
  { id: 'ord-3', symbol: 'TSLA', side: 'buy', quantity: 5, price: 245.1, status: 'partially_filled' },
  { id: 'ord-4', symbol: 'ETH', side: 'buy', quantity: 1.5, price: 2_980, status: 'pending' },
  { id: 'ord-5', symbol: 'NVDA', side: 'sell', quantity: 8, price: 118.6, status: 'pending' },
];

// --- Watchlist -----------------------------------------------------------

// TODO: source from a saved watchlist endpoint + live market quotes (MarketQuote model).
export const MOCK_WATCHLIST: MockWatchlistItem[] = [
  { symbol: 'AAPL', price: 228.4, changePct: 1.24 },
  { symbol: 'MSFT', price: 415.2, changePct: -0.42 },
  { symbol: 'BTC', price: 61_200, changePct: 3.11 },
  { symbol: 'ETH', price: 2_980, changePct: -1.05 },
  { symbol: 'SOL', price: 142.8, changePct: 5.62 },
  { symbol: 'AMZN', price: 186.3, changePct: 0.18 },
];

// --- Top Movers ------------------------------------------------------

// TODO: source from a market-wide movers endpoint scoped to the user's holdings/watchlist.
export const MOCK_TOP_WINNERS: MockMover[] = [
  { symbol: 'NVDA', changeAmount: 4.1, changePct: 3.58 },
  { symbol: 'BTC', changeAmount: 1_842.0, changePct: 3.11 },
  { symbol: 'IONQ', changeAmount: 8.42, changePct: 5.62 },
  { symbol: 'AAPL', changeAmount: 2.5, changePct: 1.1 },
  { symbol: 'TSLA', changeAmount: 3.2, changePct: 0.9 },
];

export const MOCK_TOP_LOSERS: MockMover[] = [
  { symbol: 'MSFT', changeAmount: -1.75, changePct: -0.42 },
  { symbol: 'AMD', changeAmount: -2.9, changePct: -2.14 },
  { symbol: 'GOOGL', changeAmount: -5.1, changePct: -1.8 },
  { symbol: 'AMZN', changeAmount: -3.2, changePct: -1.7 },
  { symbol: 'PLTR', changeAmount: -5.8, changePct: -1.5 }
];

// --- Allocation by Asset Type -------------------------------------------

// TODO: source from a portfolio allocation endpoint (cash vs. stocks vs. crypto vs. other).
export const MOCK_ALLOCATION_BY_TYPE: MockAllocationSlice[] = [
  { label: 'Cash', value: 10, color: '#c6c9c7' },
  { label: 'Stocks', value: 50, color: '#ff8c00' },
  { label: 'Crypto', value: 40, color: '#4fc46a' },
];

// --- Allocation by Asset (per category) -----------------------------------

// TODO: source from a per-category holdings breakdown endpoint, keyed by category.
export const MOCK_ALLOCATION_BY_ASSET: Record<string, MockAllocationSlice[]> = {
  Stocks: [
    { label: 'AAPL', value: 40, color: '#ff8c00' },
    { label: 'MSFT', value: 35, color: '#ffa31a' },
    { label: 'NVDA', value: 25, color: '#d97700' },
  ],
  Crypto: [
    { label: 'BTC', value: 60, color: '#4fc46a' },
    { label: 'ETH', value: 35, color: '#7fd68f' },
    { label: 'ADA', value: 5, color: '#2f8f45' },
  ],
  Cash: [{ label: 'USD', value: 100, color: '#c6c9c7' }],
};

// --- Performance Graph -------------------------------------------------

export type PerformanceInterval =
  '1D'
  | '1W'
  | '1M'
  | 'YTD'
  | '1Y'
  | '5Y'
  | '10Y'
  | 'ALL';

export interface PerformancePoint {
  label: string;
  value: number;
}

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

// Point count + axis label formatting per interval, used only to shape the
// mock series below.
const INTERVAL_CONFIG: Record<PerformanceInterval, { points: number; labelEvery: number; unit: string }> = {
  '1D': { points: 24, labelEvery: 4, unit: 'h' },
  '1W': { points: 7, labelEvery: 1, unit: 'd' },
  '1M': { points: 30, labelEvery: 5, unit: 'd' },
  YTD: { points: 12, labelEvery: 1, unit: 'mo' },
  '1Y': { points: 12, labelEvery: 1, unit: 'mo' },
  '5Y': { points: 20, labelEvery: 4, unit: 'q' },
  '10Y': { points: 20, labelEvery: 4, unit: 'q' },
  ALL: { points: 24, labelEvery: 4, unit: 'q' },
};

// Simple seeded PRNG so the mock series is stable across re-renders
// (switching intervals back and forth won't reshuffle the shape).
function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

// TODO: replace with a real endpoint, e.g. GET /portfolio/performance?interval=1D,
// returning actual historical portfolio valuations for the selected range.
export function getMockPerformanceSeries(interval: PerformanceInterval): PerformancePoint[] {
  const { points, labelEvery, unit } = INTERVAL_CONFIG[interval];
  const random = seededRandom(interval.charCodeAt(0) * 31 + interval.length);

  let value = 55_000;
  const series: PerformancePoint[] = [];

  for (let i = 0; i < points; i++) {
    value += (random() - 0.45) * value * 0.03;
    series.push({
      label: i % labelEvery === 0 ? `${i}${unit}` : '',
      value: Math.round(value * 100) / 100,
    });
  }

  return series;
}
