import {
  CASH_CURRENCIES,
  CashCurrency,
  HoldingResponse,
  InstrumentClass,
  InstrumentResponse,
  OrderLogResponse,
  QuoteResponse,
  WatchlistResponse,
} from '@core/models/api.models';
import { ORDER_STATUS, isActiveOrderStatus } from '@core/constants/order-status.constants';
import {
  Holding,
  HoldingInstrumentClass,
  InstrumentType,
  Order,
  SharedWatchlist,
  Transaction,
} from '@core/models';
import { toDisplaySymbol } from '@shared/utils/display-format';
import { roundChangePct } from '@shared/utils/format-percentage-change';

const TRADE_SIDES = new Set(['BUY', 'SELL']);

const toTimestamp = (value: string): number => new Date(value).getTime();

const buildInstrumentById = (
  instruments: InstrumentResponse[],
): ReadonlyMap<string, InstrumentResponse> => {
  return new Map(instruments.map((instrument) => [instrument.instrumentId, instrument]));
};

const buildLatestExecutedPriceByInstrumentId = (
  orderLogs: OrderLogResponse[],
): ReadonlyMap<string, number> => {
  const latestByInstrumentId = new Map<string, { timestamp: number; price: number }>();

  for (const row of orderLogs) {
    if (row.status !== ORDER_STATUS.EXECUTED || row.executionPrice <= 0) {
      continue;
    }

    const timestamp = toTimestamp(row.timestamp);
    const current = latestByInstrumentId.get(row.instrumentId);

    if (!current || timestamp > current.timestamp) {
      latestByInstrumentId.set(row.instrumentId, {
        timestamp,
        price: row.executionPrice,
      });
    }
  }

  return new Map(
    Array.from(latestByInstrumentId.entries()).map(([instrumentId, value]) => [
      instrumentId,
      value.price,
    ]),
  );
};

export interface HoldingPriceResolver {
  isKnownSymbol(symbol: string): boolean;
  getPrice(symbol: string): number | null;
}

const extractStatusReason = (metadata: string | null): string => {
  if (!metadata) {
    return 'The order could not be completed.';
  }

  for (const key of ['rejectionReason=', 'failureReason=']) {
    const start = metadata.indexOf(key);
    if (start < 0) {
      continue;
    }

    const valueStart = start + key.length;
    const separator = metadata.indexOf(' | ', valueStart);
    const rawValue =
      separator >= 0 ? metadata.slice(valueStart, separator) : metadata.slice(valueStart);
    const trimmedValue = rawValue.trim();

    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }

  return 'The order could not be completed.';
};

export const toInstrumentType = (instrumentClass: InstrumentClass): InstrumentType | null => {
  switch (instrumentClass) {
    case 'EQUITY':
      return 'equity';
    case 'ETF':
      return 'etf';
    case 'CRYPTO':
      return 'crypto';
    case 'FX':
    case 'CASH':
      return null;
  }
};

const toHoldingInstrumentClass = (
  instrumentClass: InstrumentClass,
): HoldingInstrumentClass | null => {
  switch (instrumentClass) {
    case 'EQUITY':
    case 'ETF':
    case 'CRYPTO':
      return instrumentClass;
    case 'FX':
    case 'CASH':
      return null;
  }
};

export const toCash = (holdings: HoldingResponse[], instruments: InstrumentResponse[]): number => {
  const instrumentsById = buildInstrumentById(instruments);

  for (const holding of holdings) {
    const instrument = instrumentsById.get(holding.instrumentID);
    if (instrument && instrument.instrumentClass === 'CASH' && instrument.ticker === 'USD') {
      return holding.currentQuantity;
    }
  }

  return 0;
};

export const toCashBalances = (
  holdings: HoldingResponse[],
  instruments: InstrumentResponse[],
): Record<string, number> => {
  const cashTickerById = new Map(
    instruments
      .filter((instrument) => instrument.instrumentClass === 'CASH')
      .map((instrument) => [instrument.instrumentId, instrument.ticker]),
  );
  const balances: Record<string, number> = {};

  for (const holding of holdings) {
    const ticker = cashTickerById.get(holding.instrumentID);
    if (ticker) {
      balances[ticker] = holding.currentQuantity;
    }
  }

  return balances;
};

export const toHoldings = (
  holdings: HoldingResponse[],
  instruments: InstrumentResponse[],
  orderLogs: OrderLogResponse[],
  holdingPriceResolver: HoldingPriceResolver,
): Holding[] => {
  const instrumentsById = buildInstrumentById(instruments);
  const latestExecutedPriceByInstrumentId = buildLatestExecutedPriceByInstrumentId(orderLogs);
  const mapped: Holding[] = [];

  for (const holding of holdings) {
    if (holding.currentQuantity <= 0) {
      continue;
    }

    const instrument = instrumentsById.get(holding.instrumentID);
    if (!instrument) {
      continue;
    }

    const instrumentType = toInstrumentType(instrument.instrumentClass);
    if (!instrumentType) {
      continue;
    }
    const instrumentClass = toHoldingInstrumentClass(instrument.instrumentClass);
    if (!instrumentClass) {
      continue;
    }

    const indicativePrice = holdingPriceResolver.isKnownSymbol(instrument.ticker)
      ? holdingPriceResolver.getPrice(instrument.ticker)
      : (latestExecutedPriceByInstrumentId.get(holding.instrumentID) ?? null);

    mapped.push({
      symbol: instrument.ticker,
      currency: instrument.tradingCurrency,
      instrumentType,
      instrumentClass,
      quantity: holding.currentQuantity,
      indicativePrice,
      priceStatus:
        indicativePrice !== null && indicativePrice > 0 ? 'available' : 'price unavailable',
    });
  }

  return mapped;
};

export const toOrders = (
  orderLogs: OrderLogResponse[],
  instruments: InstrumentResponse[],
): Order[] => {
  const instrumentsById = buildInstrumentById(instruments);
  const grouped = new Map<string, OrderLogResponse[]>();

  for (const row of orderLogs) {
    const rows = grouped.get(row.orderId) ?? [];
    rows.push(row);
    grouped.set(row.orderId, rows);
  }

  const mappedWithSortKey: Array<{ order: Order; newestTimestamp: number }> = [];

  for (const [, rows] of grouped) {
    if (rows.length === 0) {
      continue;
    }

    const sortedByTime = [...rows].sort(
      (a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp),
    );
    const firstRow = sortedByTime[0];
    const newestRow = sortedByTime[sortedByTime.length - 1];

    if (!TRADE_SIDES.has(newestRow.side)) {
      continue;
    }

    const instrument = instrumentsById.get(newestRow.instrumentId);
    if (!instrument) {
      continue;
    }

    const instrumentType = toInstrumentType(instrument.instrumentClass);
    if (!instrumentType) {
      continue;
    }

    const baseOrder: Order = {
      id: newestRow.orderId,
      symbol: instrument.ticker,
      currency: instrument.tradingCurrency,
      instrumentType,
      type: newestRow.side === 'BUY' ? 'buy' : 'sell',
      quantity: newestRow.quantity,
      createdAt: firstRow.timestamp,
      status: newestRow.status,
    };

    mappedWithSortKey.push({
      order: {
        ...baseOrder,
        ...(newestRow.status === ORDER_STATUS.EXECUTED
          ? { fillPrice: newestRow.executionPrice, filledAt: newestRow.timestamp }
          : {}),
        ...(newestRow.status === ORDER_STATUS.CANCELLED
          ? { cancelledAt: newestRow.timestamp }
          : {}),
        ...(newestRow.status === ORDER_STATUS.REJECTED || newestRow.status === ORDER_STATUS.FAILED
          ? { statusReason: extractStatusReason(newestRow.metadata) }
          : {}),
      },
      newestTimestamp: toTimestamp(newestRow.timestamp),
    });
  }

  return mappedWithSortKey
    .sort((a, b) => b.newestTimestamp - a.newestTimestamp)
    .map(({ order }) => order);
};

const readMetadataValue = (metadata: string | null, key: string): string | null => {
  if (!metadata) {
    return null;
  }

  for (const part of metadata.split(';')) {
    const [name, ...rest] = part.split('=');
    if (name.trim() === key) {
      const value = rest.join('=').trim();
      return value.length > 0 ? value : null;
    }
  }

  return null;
};

const toCashCurrency = (value: string | null | undefined): CashCurrency | undefined => {
  const normalized = value?.toUpperCase();
  return CASH_CURRENCIES.find((currency) => currency === normalized);
};

export const toTransactions = (
  orderLogs: OrderLogResponse[],
  instruments: InstrumentResponse[],
): Transaction[] => {
  const instrumentsById = buildInstrumentById(instruments);
  const grouped = new Map<string, OrderLogResponse[]>();

  for (const row of orderLogs) {
    const rows = grouped.get(row.orderId) ?? [];
    rows.push(row);
    grouped.set(row.orderId, rows);
  }

  const mappedWithSortKey: Array<{ transaction: Transaction; newestTimestamp: number }> = [];

  for (const [, rows] of grouped) {
    if (rows.length === 0) {
      continue;
    }

    const sortedByTime = [...rows].sort(
      (a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp),
    );
    const firstRow = sortedByTime[0];
    const newestRow = sortedByTime[sortedByTime.length - 1];

    if (newestRow.side !== 'DEPOSIT' && newestRow.side !== 'WITHDRAW' && newestRow.side !== 'FX') {
      continue;
    }

    const isExchange = newestRow.side === 'FX';
    const sourceCurrency = readMetadataValue(newestRow.metadata, 'sourceCurrency');
    const targetCurrency = readMetadataValue(newestRow.metadata, 'targetCurrency');
    const currency = toCashCurrency(
      isExchange ? sourceCurrency : instrumentsById.get(newestRow.instrumentId)?.ticker,
    );

    mappedWithSortKey.push({
      transaction: {
        id: newestRow.orderId,
        type: isExchange ? 'exchange' : newestRow.side === 'DEPOSIT' ? 'deposit' : 'withdrawal',
        ...(isExchange && sourceCurrency && targetCurrency
          ? { typeLabel: `${sourceCurrency} → ${targetCurrency}` }
          : {}),
        amount: newestRow.quantity,
        ...(currency ? { currency } : {}),
        method: 'bank_transfer',
        status: newestRow.status,
        createdAt: firstRow.timestamp,
      },
      newestTimestamp: toTimestamp(newestRow.timestamp),
    });
  }

  return mappedWithSortKey
    .sort((a, b) => b.newestTimestamp - a.newestTimestamp)
    .map(({ transaction }) => transaction);
};

export const toWatchlists = (
  watchlists: WatchlistResponse[],
  instruments: InstrumentResponse[],
): SharedWatchlist[] => {
  const instrumentsById = buildInstrumentById(instruments);
  return watchlists.map((watchlist) => ({
    id: watchlist.watchlistId,
    name: watchlist.watchlistName,
    symbols: watchlist.items
      .map((item) => instrumentsById.get(item.instrumentId)?.ticker ?? null)
      .filter((symbol): symbol is string => symbol !== null),
  }));
};

export const toLatestPriceBySymbol = (
  orderLogs: OrderLogResponse[],
  instruments: InstrumentResponse[],
): Map<string, number> => {
  const instrumentsById = buildInstrumentById(instruments);
  const grouped = new Map<string, OrderLogResponse[]>();

  for (const row of orderLogs) {
    if (!instrumentsById.has(row.instrumentId)) {
      continue;
    }

    const rows = grouped.get(row.instrumentId) ?? [];
    rows.push(row);
    grouped.set(row.instrumentId, rows);
  }

  const pricesBySymbol = new Map<string, number>();

  for (const [instrumentId, rows] of grouped.entries()) {
    const instrument = instrumentsById.get(instrumentId);
    if (!instrument) {
      continue;
    }

    const newestExecution = [...rows]
      .filter((row) => row.executionPrice > 0)
      .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))[0];

    if (newestExecution) {
      pricesBySymbol.set(instrument.ticker, newestExecution.executionPrice);
      continue;
    }

    const newestQuoted = [...rows]
      .filter((row) => (row.quotedPrice ?? 0) > 0)
      .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))[0];

    if (newestQuoted && newestQuoted.quotedPrice) {
      pricesBySymbol.set(instrument.ticker, newestQuoted.quotedPrice);
    }
  }

  return pricesBySymbol;
};

export const toOpenOrders = (
  orderLogs: OrderLogResponse[],
  instruments: InstrumentResponse[],
): Order[] => {
  const instrumentsById = buildInstrumentById(instruments);
  const grouped = new Map<string, OrderLogResponse[]>();

  for (const row of orderLogs) {
    const rows = grouped.get(row.orderId) ?? [];
    rows.push(row);
    grouped.set(row.orderId, rows);
  }

  const mapped: Order[] = [];

  for (const [, rows] of grouped) {
    if (rows.length === 0) {
      continue;
    }

    const sortedByTime = [...rows].sort(
      (a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp),
    );
    const firstRow = sortedByTime[0];
    const newestRow = sortedByTime[sortedByTime.length - 1];

    if (!isActiveOrderStatus(newestRow.status)) {
      continue;
    }

    if (!TRADE_SIDES.has(newestRow.side)) {
      continue;
    }

    const instrument = instrumentsById.get(newestRow.instrumentId);
    if (!instrument) {
      continue;
    }

    const instrumentType = toInstrumentType(instrument.instrumentClass);
    if (!instrumentType) {
      continue;
    }

    mapped.push({
      id: newestRow.orderId,
      symbol: instrument.ticker,
      currency: instrument.tradingCurrency,
      instrumentType,
      type: newestRow.side === 'BUY' ? 'buy' : 'sell',
      quantity: newestRow.quantity,
      fillPrice: newestRow.executionPrice === 0 ? undefined : newestRow.executionPrice,
      status: newestRow.status,
      createdAt: firstRow.timestamp,
    });
  }

  return mapped.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
};

// Fauxnance prices crypto only as X:<ticker>-USD; a plain "BTC" is quoted as a stock there.
export const toQuoteSymbol = (instrument: InstrumentResponse): string => {
  const ticker = instrument.ticker.toUpperCase();
  return instrument.instrumentClass === 'CRYPTO' && !ticker.startsWith('X:')
    ? `X:${ticker}-USD`
    : instrument.ticker;
};

// Crypto can be stored as "BTC" or "X:BTC-USD", so a quote is filed under both spellings.
const setQuoteKeys = <T>(map: Map<string, T>, symbol: string, value: T): void => {
  const key = symbol.toUpperCase();
  map.set(key, value);
  map.set(toDisplaySymbol(key), value);
};

export const toQuoteSymbols = (instruments: InstrumentResponse[]): string[] =>
  instruments
    .filter((instrument) => toInstrumentType(instrument.instrumentClass) !== null)
    .map(toQuoteSymbol);

export const toQuotePriceBySymbol = (quotes: QuoteResponse[]): Map<string, number> => {
  const prices = new Map<string, number>();

  for (const quote of quotes) {
    if (quote.price !== null && quote.price > 0) {
      setQuoteKeys(prices, quote.symbol, quote.price);
    }
  }

  return prices;
};

export interface LiveQuote {
  price: number;
  changePct: number | null;
  currency: CashCurrency;
}

export const toLiveQuoteBySymbol = (quotes: QuoteResponse[]): Map<string, LiveQuote> => {
  const liveQuotes = new Map<string, LiveQuote>();

  for (const quote of quotes) {
    if (quote.price !== null && quote.price > 0) {
      const currency = toCashCurrency(quote.currency);
      if (!currency) {
        console.warn(
          `Skipping live quote ${quote.symbol}: unsupported or missing currency "${quote.currency}".`,
        );
        continue;
      }

      setQuoteKeys(liveQuotes, quote.symbol, {
        price: quote.price,
        changePct: quote.changePercent === null ? null : roundChangePct(quote.changePercent),
        currency,
      });
    }
  }

  return liveQuotes;
};

export const toPriceResolver = (prices: Map<string, number>): HoldingPriceResolver => ({
  isKnownSymbol: (symbol) => prices.has(symbol.toUpperCase()),
  getPrice: (symbol) => prices.get(symbol.toUpperCase()) ?? null,
});
