import { describe, expect, it } from 'vitest';
import { HoldingResponse, InstrumentResponse, OrderLogResponse } from '@core/models/api.models';
import { toCash, toHoldings, toInstrumentType, toOpenOrders } from './dashboard-backend.mappers';

const emptyOrderLogs: OrderLogResponse[] = [];

const instruments: InstrumentResponse[] = [
  {
    instrumentId: 'i-cash',
    ticker: 'usd_cash',
    market: 'CASH',
    name: 'US Dollar Cash',
    instrumentClass: 'USD',
    logoUrl: null,
    description: null,
  },
  {
    instrumentId: 'i-stock',
    ticker: 'AAPL',
    market: 'NASDAQ',
    name: 'Apple Inc.',
    instrumentClass: 'EQUITY',
    logoUrl: null,
    description: null,
  },
  {
    instrumentId: 'i-bond',
    ticker: 'BND',
    market: 'NYSE',
    name: 'Vanguard Total Bond Market ETF',
    instrumentClass: 'BOND',
    logoUrl: null,
    description: null,
  },
  {
    instrumentId: 'i-crypto',
    ticker: 'BTC',
    market: 'CRYPTO',
    name: 'Bitcoin',
    instrumentClass: 'CRYPTO',
    logoUrl: null,
    description: null,
  },
];

describe('dashboard-backend mappers', () => {
  it('toInstrumentType maps backend classes and treats USD and GBP as cash', () => {
    expect(toInstrumentType('EQUITY')).toBe('stock');
    expect(toInstrumentType('STOCK')).toBe('stock');
    expect(toInstrumentType('ETF')).toBe('stock');
    expect(toInstrumentType('BOND')).toBe('bond');
    expect(toInstrumentType('CRYPTO')).toBe('crypto');
    expect(toInstrumentType('USD')).toBeNull();
    expect(toInstrumentType('GBP')).toBeNull();
  });

  it('toCash returns the USD_CASH holding quantity', () => {
    const holdings: HoldingResponse[] = [
      {
        holdingID: 'h-cash',
        portfolioID: 'p-1',
        instrumentID: 'i-cash',
        currentQuantity: 1200.5,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 3,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    expect(toCash(holdings, instruments)).toBe(1200.5);
  });

  it('toCash returns 0 when USD_CASH is missing', () => {
    const holdings: HoldingResponse[] = [
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 3,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    expect(toCash(holdings, instruments)).toBe(0);
  });

  it('toHoldings skips cash instruments and zero quantities', () => {
    const holdings: HoldingResponse[] = [
      {
        holdingID: 'h-cash',
        portfolioID: 'p-1',
        instrumentID: 'i-cash',
        currentQuantity: 999,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        holdingID: 'h-zero',
        portfolioID: 'p-1',
        instrumentID: 'i-bond',
        currentQuantity: 0,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 5,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    expect(
      toHoldings(holdings, instruments, emptyOrderLogs, {
        isKnownSymbol: (symbol: string) => symbol === 'AAPL',
        getPrice: () => 199,
      }),
    ).toEqual([
      {
        symbol: 'AAPL',
        instrumentType: 'stock',
        quantity: 5,
        indicativePrice: 199,
        priceStatus: 'available',
      },
    ]);
  });

  it('toHoldings uses mock market-data price when symbol is known', () => {
    const holdings: HoldingResponse[] = [
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 5,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    const orderLogs: OrderLogResponse[] = [
      {
        logOrderId: 'l-exec',
        orderId: 'o-exec',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-01T09:00:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 188,
      },
    ];

    expect(
      toHoldings(holdings, instruments, orderLogs, {
        isKnownSymbol: (symbol: string) => symbol === 'AAPL',
        getPrice: () => 210,
      }),
    ).toEqual([
      {
        symbol: 'AAPL',
        instrumentType: 'stock',
        quantity: 5,
        indicativePrice: 210,
        priceStatus: 'available',
      },
    ]);
  });

  it('toHoldings uses latest executed price when no mock market-data price exists', () => {
    const holdings: HoldingResponse[] = [
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 5,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    const orderLogs: OrderLogResponse[] = [
      {
        logOrderId: 'l-old',
        orderId: 'o-old',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-01T09:00:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 175,
      },
      {
        logOrderId: 'l-new',
        orderId: 'o-new',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 1,
        timestamp: '2026-10-01T09:30:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 182,
      },
    ];

    expect(
      toHoldings(holdings, instruments, orderLogs, {
        isKnownSymbol: () => false,
        getPrice: () => 0,
      }),
    ).toEqual([
      {
        symbol: 'AAPL',
        instrumentType: 'stock',
        quantity: 5,
        indicativePrice: 182,
        priceStatus: 'available',
      },
    ]);
  });

  it('toHoldings uses 0 and price unavailable when neither source has a price', () => {
    const holdings: HoldingResponse[] = [
      {
        holdingID: 'h-stock',
        portfolioID: 'p-1',
        instrumentID: 'i-stock',
        currentQuantity: 5,
        cumulativeRealizedPnl: 0,
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    expect(
      toHoldings(holdings, instruments, emptyOrderLogs, {
        isKnownSymbol: () => false,
        getPrice: () => 0,
      }),
    ).toEqual([
      {
        symbol: 'AAPL',
        instrumentType: 'stock',
        quantity: 5,
        indicativePrice: 0,
        priceStatus: 'price unavailable',
      },
    ]);
  });

  it('toOpenOrders takes newest status per order and maps side and status', () => {
    const orderLogs: OrderLogResponse[] = [
      {
        logOrderId: 'l1',
        orderId: 'o-1',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 2,
        timestamp: '2026-10-01T10:00:00Z',
        metadata: null,
        status: 'SUBMITTED',
        executionPrice: 0,
      },
      {
        logOrderId: 'l2',
        orderId: 'o-1',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'BUY',
        quantity: 2,
        timestamp: '2026-10-01T10:01:00Z',
        metadata: null,
        status: 'ACCEPTED',
        executionPrice: 0,
      },
    ];

    expect(toOpenOrders(orderLogs, instruments)).toEqual([
      {
        id: 'o-1',
        symbol: 'AAPL',
        instrumentType: 'stock',
        kind: 'market',
        type: 'buy',
        quantity: 2,
        status: 'open',
        createdAt: '2026-10-01T10:00:00Z',
      },
    ]);
  });

  it('toOpenOrders excludes cancelled and executed orders', () => {
    const orderLogs: OrderLogResponse[] = [
      {
        logOrderId: 'l3',
        orderId: 'o-2',
        portfolioId: 'p-1',
        instrumentId: 'i-bond',
        side: 'SELL',
        quantity: 1,
        timestamp: '2026-10-01T11:00:00Z',
        metadata: null,
        status: 'CANCELLED',
        executionPrice: 0,
      },
      {
        logOrderId: 'l4',
        orderId: 'o-3',
        portfolioId: 'p-1',
        instrumentId: 'i-crypto',
        side: 'SELL',
        quantity: 1,
        timestamp: '2026-10-01T12:00:00Z',
        metadata: null,
        status: 'EXECUTED',
        executionPrice: 61_500,
      },
    ];

    expect(toOpenOrders(orderLogs, instruments)).toEqual([]);
  });

  it('toOpenOrders excludes DEPOSIT and excludes fillPrice when executionPrice is zero', () => {
    const orderLogs: OrderLogResponse[] = [
      {
        logOrderId: 'l5',
        orderId: 'o-4',
        portfolioId: 'p-1',
        instrumentId: 'i-stock',
        side: 'DEPOSIT',
        quantity: 100,
        timestamp: '2026-10-01T09:00:00Z',
        metadata: null,
        status: 'PENDING',
        executionPrice: 0,
      },
      {
        logOrderId: 'l6',
        orderId: 'o-5',
        portfolioId: 'p-1',
        instrumentId: 'i-bond',
        side: 'SELL',
        quantity: 4,
        timestamp: '2026-10-01T09:30:00Z',
        metadata: null,
        status: 'PENDING',
        executionPrice: 0,
      },
    ];

    expect(toOpenOrders(orderLogs, instruments)).toEqual([
      {
        id: 'o-5',
        symbol: 'BND',
        instrumentType: 'bond',
        kind: 'market',
        type: 'sell',
        quantity: 4,
        status: 'pending',
        createdAt: '2026-10-01T09:30:00Z',
      },
    ]);
  });
});
