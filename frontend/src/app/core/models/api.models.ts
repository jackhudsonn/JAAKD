export type InstrumentClass = 'ETF' | 'EQUITY' | 'STOCK' | 'BOND' | 'CASH' | 'CRYPTO';

export type OrderSide = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';

export type OrderStatus =
  'SUBMITTED' | 'PENDING' | 'CANCELLED' | 'ACCEPTED' | 'REJECTED' | 'EXECUTED' | 'FAILED';

export interface PortfolioResponse {
  portfolioId: string;
  portfolioName: string;
}

export interface HoldingResponse {
  holdingID: string;
  portfolioID: string;
  instrumentID: string;
  currentQuantity: number;
  cumulativeRealizedPnl: number;
  updatedAt: string;
}

export interface InstrumentResponse {
  instrumentId: string;
  ticker: string;
  market: string;
  name: string;
  instrumentClass: InstrumentClass;
  logoUrl: string | null;
  description: string | null;
}

export interface OrderLogResponse {
  logOrderId: string;
  orderId: string;
  portfolioId: string;
  instrumentId: string;
  side: OrderSide;
  quantity: number;
  timestamp: string;
  metadata: string | null;
  status: OrderStatus;
  executionPrice: number;
}
