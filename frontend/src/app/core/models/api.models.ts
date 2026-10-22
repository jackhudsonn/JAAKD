export type InstrumentClass = 'EQUITY' | 'ETF' | 'FX' | 'CRYPTO' | 'CASH';
export type OrderSide = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW' | 'FX';
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
  quotedPrice: number | null;
}

export interface OrderLogListResponse {
  orderLogs: OrderLogResponse[];
}

export interface CreateOrderLogRequest {
  orderId: string;
  portfolioId: string;
  instrumentId: string;
  side: OrderSide;
  quantity: number;
  metadata?: string;
}

export interface WatchlistItemResponse {
  listItemId: string;
  watchlistId: string;
  instrumentId: string;
}

export interface WatchlistResponse {
  watchlistId: string;
  watchlistName: string;
  items: WatchlistItemResponse[];
}

export interface CreateWatchlistRequest {
  watchlistName: string;
}

export interface UpdateWatchlistRequest {
  watchlistName: string;
}

export interface CreateWatchlistEntryRequest {
  instrumentId: string;
}

export interface UpdatePreferencesRequest {
  dashboardWidgets: string[];
}

export interface PreferencesResponse {
  preferenceId: string;
  portfolioId: string;
  dashboardWidgets: string[];
  createdAt: string;
  updatedAt: string;
}

export type BankAccountType = 'checking' | 'savings';

export interface CreatePaymentMethodRequest {
  nickname: string;
  accountHolderName: string;
  bankName: string;
  accountType: BankAccountType;
  routingNumber: string;
  accountNumber: string;
}

export interface PaymentMethodResponse {
  paymentMethodId: string;
  nickname: string;
  accountHolderName: string;
  bankName: string;
  accountType: BankAccountType;
  routingNumber: string;
  accountNumberLast4: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteResponse {
  symbol: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  currency: string | null;
  asOf: string | null;
  marketState: string | null;
  changePercent: number | null;
}

export type CashCurrency = 'USD' | 'EUR' | 'GBP' | 'INR';

export const CASH_CURRENCIES: readonly CashCurrency[] = ['USD', 'EUR', 'GBP', 'INR'];

export interface CashConversionRequest {
  sourceCurrency: CashCurrency;
  targetCurrency: CashCurrency;
  sourceAmount: number;
  metadata?: string | null;
}

export interface CashConversionResponse {
  orderId: string;
  logOrderId: string;
  portfolioId: string;
  sourceCurrency: CashCurrency;
  targetCurrency: CashCurrency;
  sourceAmount: number;
  conversionRate: number;
  targetAmount: number;
  sourceBalanceAfter: number;
  targetBalanceAfter: number;
  metadata: string | null;
  convertedAt: string;
}
