import { signal } from '@angular/core';
import {
  Holding,
  InstrumentType,
  Order,
  Transaction,
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../models';
import { LineChartPoint } from '../../shared/components/line-chart/line-chart.component';

// Unified source of mock fixtures for Dashboard, Trade, and Transact.
// TODO: Replace this module with real services once backend endpoints exist.

// --- Trade assets/pricing --------------------------------------------------

export interface MockAsset {
  symbol: string;
  name: string;
  instrumentType: InstrumentType;
  basePrice: number;
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

// --- Trade fixtures --------------------------------------------------------

export const MOCK_ACCOUNT_CASH = 25_000;

export const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'BTC', instrumentType: 'crypto', quantity: 1 },
  { symbol: 'NVDA', instrumentType: 'stock', quantity: 12 },
  { symbol: 'GOVT', instrumentType: 'bond', quantity: 40 },
];

export const MOCK_WATCHLIST_SYMBOLS: string[] = ['ETH', 'AMZN', 'BND', 'ADA'];

export interface SharedWatchlist {
  id: string;
  name: string;
  symbols: string[];
}

export const MOCK_WATCHLISTS: SharedWatchlist[] = [
  { id: 'recommendations', name: 'Recommendations', symbols: [...MOCK_WATCHLIST_SYMBOLS] },
  { id: 'save-for-later', name: 'Save for Later', symbols: ['IONQ', 'IBM', 'BTC'] },
];

export const MARKET_ORDER_PENDING_MS = 10_000;

export const TRADE_MOCK_OPEN_ORDERS: Order[] = [
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

export const TRADE_MOCK_ORDER_HISTORY: Order[] = [
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

// --- Transact fixtures -----------------------------------------------------

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-1001',
    type: 'deposit',
    amount: 5000,
    method: 'bank_transfer',
    status: 'completed',
    createdAt: '2026-08-28T14:32:00Z',
  },
  {
    id: 'txn-1002',
    type: 'withdrawal',
    amount: 750,
    method: 'bank_transfer',
    status: 'completed',
    createdAt: '2026-08-26T09:05:00Z',
  },
  {
    id: 'txn-1003',
    type: 'deposit',
    amount: 1200,
    method: 'card',
    status: 'pending',
    createdAt: '2026-08-25T18:47:00Z',
  },
  {
    id: 'txn-1004',
    type: 'withdrawal',
    amount: 300,
    method: 'crypto_wallet',
    status: 'failed',
    createdAt: '2026-08-22T11:20:00Z',
  },
  {
    id: 'txn-1005',
    type: 'deposit',
    amount: 2500,
    method: 'crypto_wallet',
    status: 'completed',
    createdAt: '2026-08-19T07:58:00Z',
  },
  {
    id: 'txn-1006',
    type: 'withdrawal',
    amount: 1000,
    method: 'card',
    status: 'cancelled',
    createdAt: '2026-08-15T16:10:00Z',
  },
  {
    id: 'txn-1007',
    type: 'deposit',
    amount: 400,
    method: 'bank_transfer',
    status: 'completed',
    createdAt: '2026-08-10T13:03:00Z',
  },
  {
    id: 'txn-1008',
    type: 'withdrawal',
    amount: 150,
    method: 'crypto_wallet',
    status: 'pending',
    createdAt: '2026-08-05T20:44:00Z',
  },
];

// --- Dashboard fixtures ----------------------------------------------------

export interface MockOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'partially_filled';
}

export interface MockMover {
  symbol: string;
  changeAmount: number;
  changePct: number;
}

export const MOCK_PORTFOLIO_VALUE = {
  cash: 12_430.55,
  assets: 48_912.1,
  get total() {
    return this.cash + this.assets;
  },
};

export const MOCK_RETURNS = {
  allTime: 9_284.32,
  daily: 182.47,
};

export const DASHBOARD_MOCK_OPEN_ORDERS: MockOrder[] = [
  { id: 'ord-1', symbol: 'AAPL', side: 'buy', quantity: 10, price: 228.4, status: 'pending' },
  { id: 'ord-2', symbol: 'BTC', side: 'sell', quantity: 0.25, price: 61_200, status: 'pending' },
  {
    id: 'ord-3',
    symbol: 'TSLA',
    side: 'buy',
    quantity: 5,
    price: 245.1,
    status: 'partially_filled',
  },
  { id: 'ord-4', symbol: 'ETH', side: 'buy', quantity: 1.5, price: 2_980, status: 'pending' },
  { id: 'ord-5', symbol: 'NVDA', side: 'sell', quantity: 8, price: 118.6, status: 'pending' },
];

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
  { symbol: 'PLTR', changeAmount: -5.8, changePct: -1.5 },
];

export type PerformanceInterval = '1D' | '1W' | '1M' | 'YTD' | '1Y' | '5Y' | '10Y' | 'ALL';

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

const INTERVAL_CONFIG: Record<
  PerformanceInterval,
  { points: number; labelEvery: number; unit: string }
> = {
  '1D': { points: 24, labelEvery: 4, unit: 'h' },
  '1W': { points: 7, labelEvery: 1, unit: 'd' },
  '1M': { points: 30, labelEvery: 5, unit: 'd' },
  YTD: { points: 12, labelEvery: 1, unit: 'mo' },
  '1Y': { points: 12, labelEvery: 1, unit: 'mo' },
  '5Y': { points: 20, labelEvery: 4, unit: 'q' },
  '10Y': { points: 20, labelEvery: 4, unit: 'q' },
  ALL: { points: 24, labelEvery: 4, unit: 'q' },
};

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

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

// --- Shared in-memory mock state ------------------------------------------

export const MOCK_STATE = {
  accountCash: signal<number>(MOCK_ACCOUNT_CASH),
  holdings: signal<Holding[]>([...MOCK_HOLDINGS]),
  orders: signal<Order[]>([...TRADE_MOCK_OPEN_ORDERS, ...TRADE_MOCK_ORDER_HISTORY]),
  watchlists: signal<SharedWatchlist[]>([...MOCK_WATCHLISTS]),
  activeWatchlistId: signal<string>('recommendations'),
  transactions: signal<Transaction[]>([...MOCK_TRANSACTIONS]),
  dashboardOpenOrders: signal<MockOrder[]>([...DASHBOARD_MOCK_OPEN_ORDERS]),
};

export function addMockTransaction(type: TransactionType, amount: number, method: PaymentMethod) {
  const status: TransactionStatus = 'pending';

  const transaction: Transaction = {
    id: `txn-${Date.now()}`,
    type,
    amount,
    method,
    status,
    createdAt: new Date().toISOString(),
  };

  MOCK_STATE.transactions.update((current) => [transaction, ...current]);
  MOCK_STATE.accountCash.update((cash) => (type === 'deposit' ? cash + amount : cash - amount));
}
