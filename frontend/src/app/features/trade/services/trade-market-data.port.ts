import { InjectionToken } from '@angular/core';
import { InstrumentType } from '@core/models';
import type { CashCurrency } from '@core/models/api.models';

export interface TradeMarketAsset {
  symbol: string;
  name: string;
  currency: CashCurrency;
  instrumentType: InstrumentType;
  basePrice: number | null;
}

export interface TradeMarketDataPort {
  listAssets(): readonly TradeMarketAsset[];
  getAsset(symbol: string): TradeMarketAsset | undefined;
  getPrice(symbol: string): number | null;
  isKnownSymbol(symbol: string): boolean;
}

export const TRADE_MARKET_DATA_PORT = new InjectionToken<TradeMarketDataPort>(
  'TRADE_MARKET_DATA_PORT',
  {
    providedIn: 'root',
    factory: () => {
      throw new Error('TRADE_MARKET_DATA_PORT requires a backend provider.');
    },
  },
);
