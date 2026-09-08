import { Holding, InstrumentType, Order } from '../../core/models';
import { LineChartPoint } from '../../shared/components/line-chart/line-chart.component';

// Centralised mock data for the Trade page.
// TODO: replace every export below with calls into real services
// (e.g. MarketDataService, PortfolioService, OrdersService) once the
// Spring Boot API + a real market feed are available.

export interface MockAsset {
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
  basePrice: number;
  /** Relative swing (0-1) used only to shape the mock price wave below. */
  volatility: number;
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
    basePrice: 72.8,
    volatility: 0.004,
  },
];

export function getAsset(symbol: string): MockAsset | undefined {
  return MOCK_ASSETS.find((asset) => asset.symbol === symbol);
}

// TODO: replace with MarketDataService streaming real quotes per symbol.
// Deterministic, time-based pseudo-price: it drifts smoothly as real time
// passes (so re-renders a moment apart show slightly different prices)
// without needing a backend or persisted state.
export function getMockPrice(symbol: string): number {
  const asset = getAsset(symbol);
  if (!asset) {
    return 0;
  }

  const seed = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const t = Date.now() / 1000;
  const wave = Math.sin(t / 20 + seed) * 0.5 + Math.sin(t / 47 + seed * 1.7) * 0.5;

  return Math.max(0.01, asset.basePrice * (1 + wave * asset.volatility));
}

// TODO: replace with a real historical-prices endpoint, e.g.
// GET /market/{symbol}/history?points=30.
// Samples the same wave function used by getMockPrice at past timestamps so
// the chart is consistent with the "live" price shown alongside it.
export function getMockPriceHistory(symbol: string, points = 30): LineChartPoint[] {
  const asset = getAsset(symbol);
  if (!asset) {
    return [];
  }

  const seed = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const now = Date.now() / 1000;
  const stepSeconds = 60;

  const history: LineChartPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * stepSeconds;
    const wave = Math.sin(t / 20 + seed) * 0.5 + Math.sin(t / 47 + seed * 1.7) * 0.5;
    const value = Math.max(0.01, asset.basePrice * (1 + wave * asset.volatility));
    history.push({ label: i === 0 ? 'now' : `-${i}m`, value: Math.round(value * 100) / 100 });
  }

  return history;
}

// --- Account & Holdings ---------------------------------------------------

// TODO: source from AccountService.getCash().
export const MOCK_ACCOUNT_CASH = 25_000;

// TODO: source from PortfolioService.getHoldings().
export const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'BTC', instrumentType: 'crypto', quantity: 2 },
  { symbol: 'NVDA', instrumentType: 'stock', quantity: 12 },
  { symbol: 'GOVT', instrumentType: 'bond', quantity: 40 },
];

// --- Watchlist -------------------------------------------------------------

// TODO: source from a saved watchlist endpoint.
export const MOCK_WATCHLIST_SYMBOLS: string[] = ['ETH', 'AMZN', 'BND', 'ADA'];

// --- Orders ------------------------------------------------------------

// How long a market order stays "pending" before it fills at the current
// mock price. See TradeComponent.processOrders().
export const MARKET_ORDER_PENDING_MS = 10_000;

// TODO: source from OrdersService.getOpenOrders().
export const MOCK_OPEN_ORDERS: Order[] = [
  {
    id: 'ord-seed-1',
    symbol: 'ETH',
    instrumentType: 'crypto',
    kind: 'limit',
    type: 'buy',
    quantity: 2,
    limitPrice: 2_800,
    status: 'open',
    createdAt: '2026-09-01T14:32:00Z',
  },
  {
    id: 'ord-seed-2',
    symbol: 'AMZN',
    instrumentType: 'stock',
    kind: 'limit',
    type: 'sell',
    quantity: 4,
    limitPrice: 210,
    status: 'open',
    createdAt: '2026-09-02T09:05:00Z',
  },
];

// TODO: source from OrdersService.getHistory().
export const MOCK_ORDER_HISTORY: Order[] = [
  {
    id: 'ord-seed-3',
    symbol: 'NVDA',
    instrumentType: 'stock',
    kind: 'market',
    type: 'buy',
    quantity: 5,
    fillPrice: 112.3,
    status: 'filled',
    createdAt: '2026-08-28T14:32:00Z',
    filledAt: '2026-08-28T14:32:10Z',
  },
  {
    id: 'ord-seed-4',
    symbol: 'IBM',
    instrumentType: 'stock',
    kind: 'limit',
    type: 'sell',
    quantity: 3,
    limitPrice: 240,
    status: 'cancelled',
    createdAt: '2026-08-25T18:47:00Z',
    cancelledAt: '2026-08-26T08:00:00Z',
  },
  {
    id: 'ord-seed-5',
    symbol: 'BTC',
    instrumentType: 'crypto',
    kind: 'market',
    type: 'buy',
    quantity: 1,
    fillPrice: 59_400,
    status: 'filled',
    createdAt: '2026-08-19T07:58:00Z',
    filledAt: '2026-08-19T07:58:10Z',
  },
];
