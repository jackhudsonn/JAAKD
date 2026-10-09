import {
  HoldingResponse,
  InstrumentClass,
  InstrumentResponse,
  OrderLogResponse,
  WatchlistItemResponse,
} from '@core/models/api.models';
import { Holding, InstrumentType, Order, Transaction } from '@core/models';
import { SharedWatchlist } from '@core/mocks/watchlist.mock';

const OPEN_STATUSES = new Set(['SUBMITTED', 'PENDING', 'ACCEPTED']);
const TRADE_SIDES = new Set(['BUY', 'SELL']);
const EXECUTED_STATUS = 'EXECUTED';

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
    if (row.status !== EXECUTED_STATUS || row.executionPrice <= 0) {
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
  getPrice(symbol: string): number;
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
    case 'STOCK':
    case 'ETF':
      return 'stock';
    case 'BOND':
      return 'bond';
    case 'CRYPTO':
      return 'crypto';
    case 'CASH':
      return null;
  }
};

export const toCash = (holdings: HoldingResponse[], instruments: InstrumentResponse[]): number => {
  const instrumentsById = buildInstrumentById(instruments);

  for (const holding of holdings) {
    const instrument = instrumentsById.get(holding.instrumentID);
    if (instrument && instrument.instrumentClass === 'CASH') {
      return holding.currentQuantity;
    }
  }

  return 0;
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

    const indicativePrice = holdingPriceResolver.isKnownSymbol(instrument.ticker)
      ? holdingPriceResolver.getPrice(instrument.ticker)
      : (latestExecutedPriceByInstrumentId.get(holding.instrumentID) ?? 0);

    mapped.push({
      symbol: instrument.ticker,
      instrumentType,
      quantity: holding.currentQuantity,
      indicativePrice,
      priceStatus: indicativePrice > 0 ? 'available' : 'price unavailable',
    });
  }

  return mapped;
};

export const toOrders = (orderLogs: OrderLogResponse[], instruments: InstrumentResponse[]): Order[] => {
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
      instrumentType,
      kind: 'market',
      type: newestRow.side === 'BUY' ? 'buy' : 'sell',
      quantity: newestRow.quantity,
      createdAt: firstRow.timestamp,
      status: 'pending',
    };

    switch (newestRow.status) {
      case 'SUBMITTED':
      case 'PENDING':
        mappedWithSortKey.push({
          order: {
            ...baseOrder,
            status: 'pending',
          },
          newestTimestamp: toTimestamp(newestRow.timestamp),
        });
        break;
      case 'ACCEPTED':
        mappedWithSortKey.push({
          order: {
            ...baseOrder,
            status: 'open',
          },
          newestTimestamp: toTimestamp(newestRow.timestamp),
        });
        break;
      case 'EXECUTED':
        mappedWithSortKey.push({
          order: {
            ...baseOrder,
            status: 'filled',
            fillPrice: newestRow.executionPrice,
            filledAt: newestRow.timestamp,
          },
          newestTimestamp: toTimestamp(newestRow.timestamp),
        });
        break;
      case 'CANCELLED':
        mappedWithSortKey.push({
          order: {
            ...baseOrder,
            status: 'cancelled',
            cancelledAt: newestRow.timestamp,
          },
          newestTimestamp: toTimestamp(newestRow.timestamp),
        });
        break;
      case 'REJECTED':
      case 'FAILED':
        mappedWithSortKey.push({
          order: {
            ...baseOrder,
            status: 'rejected',
            statusReason: extractStatusReason(newestRow.metadata),
          },
          newestTimestamp: toTimestamp(newestRow.timestamp),
        });
        break;
    }
  }

  return mappedWithSortKey
    .sort((a, b) => b.newestTimestamp - a.newestTimestamp)
    .map(({ order }) => order);
};

export const toTransactions = (orderLogs: OrderLogResponse[]): Transaction[] => {
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

    if (newestRow.side !== 'DEPOSIT' && newestRow.side !== 'WITHDRAW') {
      continue;
    }

    let status: Transaction['status'] = 'pending';
    switch (newestRow.status) {
      case 'EXECUTED':
        status = 'completed';
        break;
      case 'REJECTED':
      case 'FAILED':
        status = 'failed';
        break;
      case 'CANCELLED':
        status = 'cancelled';
        break;
      default:
        status = 'pending';
        break;
    }

    mappedWithSortKey.push({
      transaction: {
        id: newestRow.orderId,
        type: newestRow.side === 'DEPOSIT' ? 'deposit' : 'withdrawal',
        amount: newestRow.quantity,
        method: 'bank_transfer',
        status,
        createdAt: firstRow.timestamp,
      },
      newestTimestamp: toTimestamp(newestRow.timestamp),
    });
  }

  return mappedWithSortKey
    .sort((a, b) => b.newestTimestamp - a.newestTimestamp)
    .map(({ transaction }) => transaction);
};

export const toWatchlist = (
  items: WatchlistItemResponse[],
  instruments: InstrumentResponse[],
): SharedWatchlist => {
  const instrumentsById = buildInstrumentById(instruments);
  const symbols: string[] = [];

  for (const item of items) {
    const instrument = instrumentsById.get(item.instrumentId);
    if (!instrument) {
      continue;
    }

    symbols.push(instrument.ticker);
  }

  return {
    id: 'watchlist',
    name: 'Watchlist',
    symbols,
  };
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

    if (!OPEN_STATUSES.has(newestRow.status)) {
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
      instrumentType,
      kind: 'market',
      type: newestRow.side === 'BUY' ? 'buy' : 'sell',
      quantity: newestRow.quantity,
      fillPrice: newestRow.executionPrice === 0 ? undefined : newestRow.executionPrice,
      status: newestRow.status === 'ACCEPTED' ? 'open' : 'pending',
      createdAt: firstRow.timestamp,
    });
  }

  return mapped.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
};
