import { HoldingResponse, InstrumentResponse, OrderLogResponse } from '@core/models/api.models';
import {
  toCash,
  toHoldings,
  toInstrumentType,
  toLatestPriceBySymbol,
  toOpenOrders,
  toOrders,
  toTransactions,
  toWatchlist,
} from './dashboard-backend.mappers';

const EQUITY_INSTRUMENT: InstrumentResponse = {
  instrumentId: 'inst-equity',
  ticker: 'AAPL',
  market: 'NASDAQ',
  name: 'Apple Inc.',
  instrumentClass: 'EQUITY',
  logoUrl: null,
  description: null,
};

const STOCK_INSTRUMENT: InstrumentResponse = {
  instrumentId: 'inst-stock',
  ticker: 'MSFT',
  market: 'NASDAQ',
  name: 'Microsoft Corp.',
  instrumentClass: 'STOCK',
  logoUrl: null,
  description: null,
};

const BOND_INSTRUMENT: InstrumentResponse = {
  instrumentId: 'inst-bond',
  ticker: 'BND',
  market: 'NASDAQ',
  name: 'Vanguard Bond ETF',
  instrumentClass: 'BOND',
  logoUrl: null,
  description: null,
};

const CASH_INSTRUMENT: InstrumentResponse = {
  instrumentId: 'inst-cash',
  ticker: 'USD',
  market: 'CASH',
  name: 'US Dollar',
  instrumentClass: 'CASH',
  logoUrl: null,
  description: null,
};

const createOrderLog = (overrides: Partial<OrderLogResponse>): OrderLogResponse => ({
  logOrderId: 'log-1',
  orderId: 'order-1',
  portfolioId: 'portfolio-1',
  instrumentId: EQUITY_INSTRUMENT.instrumentId,
  side: 'BUY',
  quantity: 1,
  timestamp: '2026-01-01T00:00:00.000Z',
  metadata: null,
  status: 'SUBMITTED',
  executionPrice: 0,
  quotedPrice: null,
  ...overrides,
});

describe('dashboard-backend.mappers', () => {
  it('exports expected helpers', () => {
    expect(typeof toCash).toBe('function');
    expect(typeof toHoldings).toBe('function');
    expect(typeof toInstrumentType).toBe('function');
    expect(typeof toOpenOrders).toBe('function');
  });

  describe('toInstrumentType', () => {
    it('maps CASH to null', () => {
      expect(toInstrumentType('CASH')).toBeNull();
    });
  });

  describe('toCash', () => {
    it('returns the CASH-class holding quantity', () => {
      const holdings: HoldingResponse[] = [
        {
          holdingID: 'holding-1',
          portfolioID: 'portfolio-1',
          instrumentID: EQUITY_INSTRUMENT.instrumentId,
          currentQuantity: 12,
          cumulativeRealizedPnl: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          holdingID: 'holding-2',
          portfolioID: 'portfolio-1',
          instrumentID: CASH_INSTRUMENT.instrumentId,
          currentQuantity: 5000,
          cumulativeRealizedPnl: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      expect(toCash(holdings, [EQUITY_INSTRUMENT, CASH_INSTRUMENT])).toBe(5000);
    });

    it('returns 0 when no CASH holding exists', () => {
      const holdings: HoldingResponse[] = [
        {
          holdingID: 'holding-1',
          portfolioID: 'portfolio-1',
          instrumentID: EQUITY_INSTRUMENT.instrumentId,
          currentQuantity: 12,
          cumulativeRealizedPnl: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      expect(toCash(holdings, [EQUITY_INSTRUMENT, CASH_INSTRUMENT])).toBe(0);
    });
  });

  describe('toOrders', () => {
    it('maps BUY/SELL orders by newest row status and returns newest first', () => {
      const orderLogs: OrderLogResponse[] = [
        createOrderLog({
          orderId: 'order-pending',
          side: 'BUY',
          status: 'SUBMITTED',
          timestamp: '2026-01-01T10:00:00.000Z',
          quantity: 2,
        }),
        createOrderLog({
          orderId: 'order-open',
          side: 'SELL',
          status: 'ACCEPTED',
          timestamp: '2026-01-01T11:00:00.000Z',
          quantity: 3,
        }),
        createOrderLog({
          orderId: 'order-filled',
          side: 'BUY',
          status: 'EXECUTED',
          timestamp: '2026-01-01T12:00:00.000Z',
          executionPrice: 101.25,
          quantity: 4,
        }),
        createOrderLog({
          orderId: 'order-cancelled',
          side: 'BUY',
          status: 'CANCELLED',
          timestamp: '2026-01-01T13:00:00.000Z',
          quantity: 5,
        }),
        createOrderLog({
          orderId: 'order-rejected',
          side: 'BUY',
          status: 'REJECTED',
          timestamp: '2026-01-01T14:00:00.000Z',
          metadata: 'rejectionReason=Not enough cash | note=foo',
          quantity: 6,
        }),
      ];

      const result = toOrders(orderLogs, [EQUITY_INSTRUMENT]);

      expect(result.map((order) => order.id)).toEqual([
        'order-rejected',
        'order-cancelled',
        'order-filled',
        'order-open',
        'order-pending',
      ]);
      expect(result.find((order) => order.id === 'order-pending')?.status).toBe('pending');
      expect(result.find((order) => order.id === 'order-open')?.status).toBe('open');

      const filled = result.find((order) => order.id === 'order-filled');
      expect(filled?.status).toBe('filled');
      expect(filled?.fillPrice).toBe(101.25);
      expect(filled?.filledAt).toBe('2026-01-01T12:00:00.000Z');

      const cancelled = result.find((order) => order.id === 'order-cancelled');
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.cancelledAt).toBe('2026-01-01T13:00:00.000Z');

      const rejected = result.find((order) => order.id === 'order-rejected');
      expect(rejected?.status).toBe('rejected');
      expect(rejected?.statusReason).toBe('Not enough cash');
      expect(rejected?.kind).toBe('market');
    });

    it('maps FAILED as rejected and reads failureReason from metadata', () => {
      const result = toOrders(
        [
          createOrderLog({
            orderId: 'order-failed',
            status: 'FAILED',
            metadata: 'failureReason=Processing error | traceId=123',
            timestamp: '2026-01-01T10:00:00.000Z',
          }),
        ],
        [EQUITY_INSTRUMENT],
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('rejected');
      expect(result[0].statusReason).toBe('Processing error');
    });

    it('uses fallback reason when metadata has no rejection or failure reason', () => {
      const result = toOrders(
        [
          createOrderLog({
            orderId: 'order-rejected-no-reason',
            status: 'REJECTED',
            metadata: 'note=something else',
            timestamp: '2026-01-01T10:00:00.000Z',
          }),
        ],
        [EQUITY_INSTRUMENT],
      );

      expect(result).toHaveLength(1);
      expect(result[0].statusReason).toBe('The order could not be completed.');
    });

    it('skips unknown and CASH instruments', () => {
      const result = toOrders(
        [
          createOrderLog({
            orderId: 'order-cash',
            instrumentId: CASH_INSTRUMENT.instrumentId,
            status: 'SUBMITTED',
            timestamp: '2026-01-01T10:00:00.000Z',
          }),
          createOrderLog({
            orderId: 'order-unknown',
            instrumentId: 'missing',
            status: 'SUBMITTED',
            timestamp: '2026-01-01T11:00:00.000Z',
          }),
        ],
        [CASH_INSTRUMENT],
      );

      expect(result).toEqual([]);
    });
  });

  describe('toTransactions', () => {
    it('maps DEPOSIT and WITHDRAW order logs into transactions newest first', () => {
      const orderLogs: OrderLogResponse[] = [
        createOrderLog({
          orderId: 'txn-deposit',
          side: 'DEPOSIT',
          status: 'SUBMITTED',
          timestamp: '2026-01-01T08:00:00.000Z',
          quantity: 1000,
        }),
        createOrderLog({
          orderId: 'txn-deposit',
          side: 'DEPOSIT',
          status: 'EXECUTED',
          timestamp: '2026-01-01T09:00:00.000Z',
          quantity: 1000,
        }),
        createOrderLog({
          orderId: 'txn-withdraw',
          side: 'WITHDRAW',
          status: 'FAILED',
          timestamp: '2026-01-01T10:00:00.000Z',
          quantity: 250,
        }),
        createOrderLog({
          orderId: 'txn-cancelled',
          side: 'DEPOSIT',
          status: 'CANCELLED',
          timestamp: '2026-01-01T11:00:00.000Z',
          quantity: 50,
        }),
        createOrderLog({
          orderId: 'txn-pending',
          side: 'WITHDRAW',
          status: 'PENDING',
          timestamp: '2026-01-01T12:00:00.000Z',
          quantity: 10,
        }),
        createOrderLog({
          orderId: 'ignore-buy',
          side: 'BUY',
          status: 'EXECUTED',
          timestamp: '2026-01-01T13:00:00.000Z',
          quantity: 1,
        }),
      ];

      const result = toTransactions(orderLogs);

      expect(result.map((transaction) => transaction.id)).toEqual([
        'txn-pending',
        'txn-cancelled',
        'txn-withdraw',
        'txn-deposit',
      ]);

      const deposit = result.find((transaction) => transaction.id === 'txn-deposit');
      expect(deposit).toEqual({
        id: 'txn-deposit',
        type: 'deposit',
        amount: 1000,
        method: 'bank_transfer',
        status: 'completed',
        createdAt: '2026-01-01T08:00:00.000Z',
      });

      expect(result.find((transaction) => transaction.id === 'txn-withdraw')?.status).toBe('failed');
      expect(result.find((transaction) => transaction.id === 'txn-cancelled')?.status).toBe(
        'cancelled',
      );
      expect(result.find((transaction) => transaction.id === 'txn-pending')?.status).toBe('pending');
    });
  });

  describe('toWatchlist', () => {
    it('returns one fixed watchlist preserving item order and skipping unknown instruments', () => {
      const result = toWatchlist(
        [
          {
            listItemId: 'item-1',
            portfolioId: 'portfolio-1',
            instrumentId: STOCK_INSTRUMENT.instrumentId,
            name: null,
          },
          {
            listItemId: 'item-2',
            portfolioId: 'portfolio-1',
            instrumentId: 'missing',
            name: null,
          },
          {
            listItemId: 'item-3',
            portfolioId: 'portfolio-1',
            instrumentId: EQUITY_INSTRUMENT.instrumentId,
            name: null,
          },
        ],
        [EQUITY_INSTRUMENT, STOCK_INSTRUMENT],
      );

      expect(result).toEqual({
        id: 'watchlist',
        name: 'Watchlist',
        symbols: ['MSFT', 'AAPL'],
      });
    });
  });

  describe('toLatestPriceBySymbol', () => {
    it('prefers newest positive execution price, then newest positive quoted price', () => {
      const orderLogs: OrderLogResponse[] = [
        createOrderLog({
          orderId: 'price-aapl-quoted-old',
          instrumentId: EQUITY_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T08:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 95,
        }),
        createOrderLog({
          orderId: 'price-aapl-executed-new',
          instrumentId: EQUITY_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T09:00:00.000Z',
          executionPrice: 100,
          quotedPrice: 110,
        }),
        createOrderLog({
          orderId: 'price-msft-quoted',
          instrumentId: STOCK_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T10:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 210,
        }),
        createOrderLog({
          orderId: 'price-msft-quoted-newer',
          instrumentId: STOCK_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T11:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 220,
        }),
        createOrderLog({
          orderId: 'price-bnd-invalid',
          instrumentId: BOND_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T12:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 0,
        }),
      ];

      const result = toLatestPriceBySymbol(orderLogs, [
        EQUITY_INSTRUMENT,
        STOCK_INSTRUMENT,
        BOND_INSTRUMENT,
      ]);

      expect(result.get('AAPL')).toBe(100);
      expect(result.get('MSFT')).toBe(220);
      expect(result.has('BND')).toBe(false);
    });
  });
});
