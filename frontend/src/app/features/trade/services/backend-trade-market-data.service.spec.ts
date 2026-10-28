import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QuoteResponse } from '@core/models/api.models';
import {
  LiveQuote,
  toLiveQuoteBySymbol,
} from '@features/dashboard/services/dashboard-backend.mappers';
import { BackendTradeMarketDataService } from './backend-trade-market-data.service';
import { BackendTradeStateService } from './backend-trade-state.service';

function quote(symbol: string, price: number, changePercent: number | null): QuoteResponse {
  return {
    symbol,
    price,
    bid: null,
    ask: null,
    currency: 'USD',
    asOf: null,
    marketState: null,
    changePercent,
  };
}

describe('BackendTradeMarketDataService', () => {
  let service: BackendTradeMarketDataService;
  const liveQuoteBySymbolData = signal<Map<string, LiveQuote>>(new Map());

  beforeEach(() => {
    liveQuoteBySymbolData.set(new Map());

    const stateStub = {
      instrumentsData: signal([
        {
          instrumentId: 'inst-aapl',
          ticker: 'AAPL',
          market: 'NASDAQ',
          name: 'Apple Inc.',
          instrumentClass: 'EQUITY',
          tradingCurrency: 'USD',
          logoUrl: null,
          description: null,
        },
        {
          instrumentId: 'inst-btc',
          ticker: 'BTC',
          market: 'CRYPTO',
          name: 'Bitcoin',
          instrumentClass: 'CRYPTO',
          tradingCurrency: 'USD',
          logoUrl: null,
          description: null,
        },
        {
          instrumentId: 'inst-usd',
          ticker: 'USD',
          market: 'CASH',
          name: 'US Dollar',
          instrumentClass: 'CASH',
          tradingCurrency: 'USD',
          logoUrl: null,
          description: null,
        },
      ]),
      latestPriceBySymbolData: signal(
        new Map([
          ['AAPL', 123.45],
          ['BTC', 60000],
          ['USD', 1],
        ]),
      ),
      liveQuoteBySymbolData,
    };

    TestBed.configureTestingModule({
      providers: [
        BackendTradeMarketDataService,
        { provide: BackendTradeStateService, useValue: stateStub },
      ],
    });

    service = TestBed.inject(BackendTradeMarketDataService);
  });

  it('lists non-cash assets with the price as base when there is no live quote', () => {
    const assets = service.listAssets();

    expect(assets).toEqual([
      {
        instrumentId: 'inst-aapl',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        currency: 'USD',
        instrumentType: 'equity',
        basePrice: 123.45,
      },
      {
        instrumentId: 'inst-btc',
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        instrumentType: 'crypto',
        basePrice: 60000,
      },
    ]);
  });

  it('sets basePrice to the previous close from the quote change percent', () => {
    liveQuoteBySymbolData.set(toLiveQuoteBySymbol([quote('AAPL', 123.45, 10)]));

    const aapl = service.getAsset('AAPL')!;
    const basePrice = aapl.basePrice;

    expect(basePrice).not.toBeNull();
    expect(basePrice!).toBeCloseTo(123.45 / 1.1, 6);
    expect(((123.45 - basePrice!) / basePrice!) * 100).toBeCloseTo(10, 6);
  });

  it('finds crypto quotes filed as X:BTC-USD by the plain ticker', () => {
    liveQuoteBySymbolData.set(toLiveQuoteBySymbol([quote('X:BTC-USD', 60000, -4)]));

    expect(service.getAsset('BTC')!.basePrice!).toBeCloseTo(60000 / 0.96, 6);
  });

  it('keeps the price as base when the change percent is null or zero', () => {
    liveQuoteBySymbolData.set(
      toLiveQuoteBySymbol([quote('AAPL', 123.45, null), quote('X:BTC-USD', 60000, 0)]),
    );

    expect(service.getAsset('AAPL')!.basePrice).toBe(123.45);
    expect(service.getAsset('BTC')!.basePrice).toBe(60000);
  });

  it('resolves asset and symbol lookups', () => {
    expect(service.isKnownSymbol('AAPL')).toBe(true);
    expect(service.isKnownSymbol('USD')).toBe(false);
    expect(service.getAsset('AAPL')?.symbol).toBe('AAPL');
    expect(service.getAsset('MSFT')).toBeUndefined();
  });

  it('returns the latest backend price or null when unavailable', () => {
    expect(service.getPrice('AAPL')).toBe(123.45);
    expect(service.getPrice('MSFT')).toBeNull();
  });
});
