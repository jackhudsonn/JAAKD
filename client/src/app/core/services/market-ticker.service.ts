import { Injectable } from '@angular/core';

export interface MarketTickerItem {
  symbol: string;
  value: string;
  changePct: number;
}

@Injectable({
  providedIn: 'root',
})
export class MarketTickerService {
  getTickerItems(): MarketTickerItem[] {
    return [
      { symbol: 'S&P 500', value: '5,742.40', changePct: 0.41 },
      { symbol: 'NASDAQ', value: '18,121.00', changePct: -0.18 },
      { symbol: 'DOW', value: '42,136.20', changePct: 0.22 },
      { symbol: 'BTC', value: '61,200.00', changePct: 1.39 },
      { symbol: 'ETH', value: '2,980.00', changePct: -1.13 },
      { symbol: 'NVDA', value: '118.60', changePct: 1.84 },
      { symbol: 'AMZN', value: '186.30', changePct: -0.76 },
    ];
  }
}
