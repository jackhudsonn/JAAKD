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
  tradingCurrency: 'USD',
  logoUrl: null,
  description: null,
});

const quote = (
  symbol: string,
  price: number | null,
  changePercent: number | null,
  currency: string | null = 'USD',
): QuoteResponse => ({
  symbol,
  price,
  bid: null,
  ask: null,
  currency,
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
      { symbol: 'NVDA', price: 118.6, currency: 'USD', changePct: 1.84 },
      { symbol: 'BTC', price: 61200, currency: 'USD', changePct: null },
    ]);
  });

  it('keeps the quote currency for display formatting', async () => {
    instrumentApi.list.mockResolvedValue([instrument('RELIANCE.NS', 'EQUITY')]);
    instrumentApi.getQuotes.mockResolvedValue([quote('RELIANCE.NS', 1234.5, 0.3, 'INR')]);

    const [item] = await service.getTickerItems();

    expect(item).toEqual({
      symbol: 'RELIANCE',
      price: 1234.5,
      currency: 'INR',
      changePct: 0.3,
    });
  });

  it('skips and warns for priced quotes with unsupported currencies', async () => {
    instrumentApi.list.mockResolvedValue([instrument('NVDA', 'EQUITY')]);
    instrumentApi.getQuotes.mockResolvedValue([quote('NVDA', 118.6, 1.84, 'JPY')]);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const items = await service.getTickerItems();

    expect(items).toEqual([]);
    expect(warning).toHaveBeenCalledWith(
      'Skipping market ticker quote NVDA: unsupported or missing currency "JPY".',
    );
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
