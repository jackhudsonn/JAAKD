// Domain interfaces — expand as the backend API is defined

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  executedAt: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
}
