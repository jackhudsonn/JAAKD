import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BackendTradeMarketDataService } from './backend-trade-market-data.service';
import { BackendTradeStateService } from './backend-trade-state.service';

describe('BackendTradeMarketDataService', () => {
  let service: BackendTradeMarketDataService;

  beforeEach(() => {
    const stateStub = {
      instrumentsData: signal([
        {
          instrumentId: 'inst-aapl',
          ticker: 'AAPL',
          market: 'NASDAQ',
          name: 'Apple Inc.',
          instrumentClass: 'EQUITY',
          logoUrl: null,
          description: null,
        },
        {
          instrumentId: 'inst-usd',
          ticker: 'USD',
          market: 'CASH',
          name: 'US Dollar',
          instrumentClass: 'CASH',
          logoUrl: null,
          description: null,
        },
      ]),
      latestPriceBySymbolData: signal(
        new Map([
          ['AAPL', 123.45],
          ['USD', 1],
        ]),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        BackendTradeMarketDataService,
        { provide: BackendTradeStateService, useValue: stateStub },
      ],
    });

    service = TestBed.inject(BackendTradeMarketDataService);
  });

  it('lists non-cash assets with backend latest prices', () => {
    const assets = service.listAssets();

    expect(assets).toEqual([
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        instrumentType: 'stock',
        basePrice: 123.45,
      },
    ]);
  });

  it('resolves asset and symbol lookups', () => {
    expect(service.isKnownSymbol('AAPL')).toBe(true);
    expect(service.isKnownSymbol('USD')).toBe(false);
    expect(service.getAsset('AAPL')?.symbol).toBe('AAPL');
    expect(service.getAsset('MSFT')).toBeUndefined();
  });

  it('returns latest backend price or zero', () => {
    expect(service.getPrice('AAPL')).toBe(123.45);
    expect(service.getPrice('MSFT')).toBe(0);
  });

  it('returns empty performance series', () => {
    expect(service.getPerformanceSeries('AAPL', '1D')).toEqual([]);
  });
});
