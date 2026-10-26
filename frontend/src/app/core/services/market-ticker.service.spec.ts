import { TestBed } from '@angular/core/testing';
import { InstrumentResponse, QuoteResponse } from '@core/models/api.models';
import { InstrumentApiService } from './instrument-api.service';
import { MarketTickerService } from './market-ticker.service';

const instrument = (
  ticker: string,
  instrumentClass: InstrumentResponse['instrumentClass'],
): InstrumentResponse => ({
  instrumentId: `inst-${ticker}`,
  ticker,
  market: 'NASDAQ',
  name: ticker,
  instrumentClass,
  logoUrl: null,
  description: null,
});

const quote = (
  symbol: string,
  price: number | null,
  changePercent: number | null,
): QuoteResponse => ({
  symbol,
  price,
  bid: null,
  ask: null,
  currency: 'USD',
  asOf: null,
  marketState: null,
  changePercent,
});

describe('MarketTickerService', () => {
  let service: MarketTickerService;
  let instrumentApi: { list: ReturnType<typeof vi.fn>; getQuotes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    instrumentApi = { list: vi.fn(), getQuotes: vi.fn() };

    TestBed.configureTestingModule({
      providers: [MarketTickerService, { provide: InstrumentApiService, useValue: instrumentApi }],
    });

    service = TestBed.inject(MarketTickerService);
  });

  it('quotes every non-cash instrument and keeps only priced quotes', async () => {
    instrumentApi.list.mockResolvedValue([
      instrument('NVDA', 'EQUITY'),
      instrument('BTC', 'CRYPTO'),
      instrument('AAPL', 'EQUITY'),
      instrument('USD', 'CASH'),
    ]);
    instrumentApi.getQuotes.mockResolvedValue([
      quote('NVDA', 118.6, 1.84),
      quote('X:BTC-USD', 61200, null),
      quote('AAPL', null, 0.5),
    ]);

    const items = await service.getTickerItems();

    expect(instrumentApi.getQuotes).toHaveBeenCalledWith(['NVDA', 'X:BTC-USD', 'AAPL']);
    expect(items).toEqual([
      { symbol: 'NVDA', price: 118.6, changePct: 1.84 },
      { symbol: 'BTC', price: 61200, changePct: null },
    ]);
  });

  it('rounds a tiny loss to a plain zero change', async () => {
    instrumentApi.list.mockResolvedValue([instrument('NVDA', 'EQUITY')]);
    instrumentApi.getQuotes.mockResolvedValue([quote('NVDA', 118.6, -0.003)]);

    const [item] = await service.getTickerItems();

    expect(Object.is(item.changePct, 0)).toBe(true);
  });

  it('skips the quotes call when there are only cash instruments', async () => {
    instrumentApi.list.mockResolvedValue([instrument('USD', 'CASH')]);

    const items = await service.getTickerItems();

    expect(instrumentApi.getQuotes).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });
});
