import {
  HoldingResponse,
  InstrumentClass,
  InstrumentResponse,
  OrderLogResponse,
} from '@core/models/api.models';
import { Holding, InstrumentType, Order } from '@core/models';

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
    case 'USD':
    case 'GBP':
      return null;
  }
};

export const toCash = (holdings: HoldingResponse[], instruments: InstrumentResponse[]): number => {
  const instrumentsById = buildInstrumentById(instruments);

  for (const holding of holdings) {
    const instrument = instrumentsById.get(holding.instrumentID);
    if (instrument && instrument.ticker.toUpperCase() === 'USD_CASH') {
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
