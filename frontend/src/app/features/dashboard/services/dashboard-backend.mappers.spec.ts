import {
  HoldingResponse,
  InstrumentResponse,
  OrderLogResponse,
  QuoteResponse,
} from '@core/models/api.models';
import {
  toCash,
  toHoldings,
  toInstrumentType,
  toLatestPriceBySymbol,
  toOpenOrders,
  toOrders,
  toLiveQuoteBySymbol,
  toPriceResolver,
  toQuotePriceBySymbol,
  toQuoteSymbols,
  toTransactions,
  toWatchlists,
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

const SECOND_EQUITY_INSTRUMENT: InstrumentResponse = {
  instrumentId: 'inst-equity-2',
  ticker: 'MSFT',
  market: 'NASDAQ',
  name: 'Microsoft Corp.',
  instrumentClass: 'EQUITY',
  logoUrl: null,
  description: null,
};

const ETF_INSTRUMENT: InstrumentResponse = {
  instrumentId: 'inst-etf',
  ticker: 'BND',
  market: 'NASDAQ',
  name: 'Vanguard Aggregate ETF',
  instrumentClass: 'ETF',
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
    it('maps FX rows to exchange transactions with a currency label', () => {
      const result = toTransactions(
        [
          createOrderLog({
            orderId: 'fx-1',
            instrumentId: CASH_INSTRUMENT.instrumentId,
            side: 'FX',
            quantity: 100,
            status: 'EXECUTED',
            metadata: 'fxConversion=true;sourceCurrency=USD;targetCurrency=EUR;sourceAmount=100',
          }),
        ],
        [],
      );

      expect(result).toEqual([
        {
          id: 'fx-1',
          type: 'exchange',
          typeLabel: 'USD → EUR',
          amount: 100,
          currency: 'USD',
          method: 'bank_transfer',
          status: 'completed',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });

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

      const result = toTransactions(orderLogs, []);

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

      expect(result.find((transaction) => transaction.id === 'txn-withdraw')?.status).toBe(
        'failed',
      );
      expect(result.find((transaction) => transaction.id === 'txn-cancelled')?.status).toBe(
        'cancelled',
      );
      expect(result.find((transaction) => transaction.id === 'txn-pending')?.status).toBe(
        'pending',
      );
    });

    it('sets the currency from the cash instrument ticker', () => {
      const eurInstrument: InstrumentResponse = {
        ...CASH_INSTRUMENT,
        instrumentId: 'inst-cash-eur',
        ticker: 'EUR',
        name: 'Euro',
      };

      const result = toTransactions(
        [
          createOrderLog({
            orderId: 'eur-deposit',
            instrumentId: eurInstrument.instrumentId,
            side: 'DEPOSIT',
            quantity: 100,
            status: 'EXECUTED',
          }),
        ],
        [CASH_INSTRUMENT, eurInstrument],
      );

      expect(result[0]?.currency).toBe('EUR');
    });

    it('leaves the currency unset when it is not a known cash currency', () => {
      const result = toTransactions(
        [
          createOrderLog({
            orderId: 'unknown-instrument',
            instrumentId: 'inst-missing',
            side: 'DEPOSIT',
            status: 'EXECUTED',
          }),
          createOrderLog({
            orderId: 'unknown-fx',
            instrumentId: CASH_INSTRUMENT.instrumentId,
            side: 'FX',
            status: 'EXECUTED',
            metadata: 'sourceCurrency=JPY;targetCurrency=USD',
          }),
        ],
        [CASH_INSTRUMENT],
      );

      expect(result).toHaveLength(2);
      for (const transaction of result) {
        expect(transaction.currency).toBeUndefined();
      }
    });
  });

  describe('toWatchlists', () => {
    it('maps watchlists preserving item order and skipping unknown instruments', () => {
      const result = toWatchlists(
        [
          {
            watchlistId: 'watchlist-1',
            watchlistName: 'Core',
            items: [
              {
                listItemId: 'item-1',
                watchlistId: 'watchlist-1',
                instrumentId: SECOND_EQUITY_INSTRUMENT.instrumentId,
              },
              {
                listItemId: 'item-2',
                watchlistId: 'watchlist-1',
                instrumentId: 'missing',
              },
              {
                listItemId: 'item-3',
                watchlistId: 'watchlist-1',
                instrumentId: EQUITY_INSTRUMENT.instrumentId,
              },
            ],
          },
          {
            watchlistId: 'watchlist-2',
            watchlistName: 'Income',
            items: [],
          },
        ],
        [EQUITY_INSTRUMENT, SECOND_EQUITY_INSTRUMENT],
      );

      expect(result).toEqual([
        {
          id: 'watchlist-1',
          name: 'Core',
          symbols: ['MSFT', 'AAPL'],
        },
        {
          id: 'watchlist-2',
          name: 'Income',
          symbols: [],
        },
      ]);
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
          instrumentId: SECOND_EQUITY_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T10:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 210,
        }),
        createOrderLog({
          orderId: 'price-msft-quoted-newer',
          instrumentId: SECOND_EQUITY_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T11:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 220,
        }),
        createOrderLog({
          orderId: 'price-bnd-invalid',
          instrumentId: ETF_INSTRUMENT.instrumentId,
          timestamp: '2026-01-01T12:00:00.000Z',
          executionPrice: 0,
          quotedPrice: 0,
        }),
      ];

      const result = toLatestPriceBySymbol(orderLogs, [
        EQUITY_INSTRUMENT,
        SECOND_EQUITY_INSTRUMENT,
        ETF_INSTRUMENT,
      ]);

      expect(result.get('AAPL')).toBe(100);
      expect(result.get('MSFT')).toBe(220);
      expect(result.has('BND')).toBe(false);
    });
  });

  describe('live price helpers', () => {
    const EUR_CASH_INSTRUMENT: InstrumentResponse = {
      ...CASH_INSTRUMENT,
      instrumentId: 'inst-eur',
      ticker: 'EUR',
      name: 'Euro',
    };

    const quote = (
      symbol: string,
      price: number | null,
      changePercent: number | null = null,
    ): QuoteResponse => ({
      symbol,
      price,
      bid: null,
      ask: null,
      currency: 'USD',
      asOf: null,
      marketState: null,
      changePercent,
    });

    it('toCash returns the USD balance when several cash currencies exist', () => {
      const holdings: HoldingResponse[] = [
        {
          holdingID: 'holding-eur',
          portfolioID: 'portfolio-1',
          instrumentID: EUR_CASH_INSTRUMENT.instrumentId,
          currentQuantity: 300,
          cumulativeRealizedPnl: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          holdingID: 'holding-usd',
          portfolioID: 'portfolio-1',
          instrumentID: CASH_INSTRUMENT.instrumentId,
          currentQuantity: 5000,
          cumulativeRealizedPnl: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      expect(toCash(holdings, [EUR_CASH_INSTRUMENT, CASH_INSTRUMENT])).toBe(5000);
    });

    it('toQuoteSymbols skips cash and FX instruments', () => {
      const fxInstrument: InstrumentResponse = {
        ...EQUITY_INSTRUMENT,
        instrumentId: 'inst-fx',
        ticker: 'EURUSD',
        instrumentClass: 'FX',
      };

      expect(toQuoteSymbols([EQUITY_INSTRUMENT, CASH_INSTRUMENT, fxInstrument])).toEqual(['AAPL']);
    });

    it('toQuotePriceBySymbol keeps only positive prices', () => {
      const prices = toQuotePriceBySymbol([
        quote('aapl', 190),
        quote('MSFT', null),
        quote('BND', 0),
      ]);

      expect(prices.get('AAPL')).toBe(190);
      expect(prices.has('MSFT')).toBe(false);
      expect(prices.has('BND')).toBe(false);
    });

    it('toLiveQuoteBySymbol keeps priced quotes with their change', () => {
      const liveQuotes = toLiveQuoteBySymbol([
        quote('nvda', 118.6, 1.84),
        quote('BTC', 61200),
        quote('MSFT', null, 0.5),
      ]);

      expect(liveQuotes.get('NVDA')).toEqual({ price: 118.6, changePct: 1.84 });
      expect(liveQuotes.get('BTC')).toEqual({ price: 61200, changePct: null });
      expect(liveQuotes.has('MSFT')).toBe(false);
    });

    it('toPriceResolver reads prices case-insensitively', () => {
      const resolver = toPriceResolver(new Map([['AAPL', 190]]));

      expect(resolver.isKnownSymbol('aapl')).toBe(true);
      expect(resolver.getPrice('AAPL')).toBe(190);
      expect(resolver.isKnownSymbol('MSFT')).toBe(false);
    });
  });
});
