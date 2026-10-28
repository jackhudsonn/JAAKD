import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TRADE_MARKET_DATA_PORT,
  TradeMarketAsset,
} from '@features/trade/services/trade-market-data.port';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { InstrumentCandleResponse } from '@core/models/api.models';
import {
  AssetPopupComponent,
  assetPriceRangeFor,
  toAveragePricePoints,
} from './asset-popup.component';

describe('AssetPopupComponent', () => {
  let fixture: ComponentFixture<AssetPopupComponent>;
  let component: AssetPopupComponent;

  let asset: TradeMarketAsset | undefined;
  let price: number | null;
  let candleRequest: () => Promise<InstrumentCandleResponse[]>;
  let requestedInstrumentId: string | null;
  let requestedDateRange: { from: string | null; to: string | null } | null;

  const marketData = {
    getAsset: (symbol: string) => (asset?.symbol === symbol ? asset : undefined),
    getPrice: () => price,
  };

  function create(symbol = 'AAPL') {
    TestBed.configureTestingModule({
      imports: [AssetPopupComponent],
      providers: [
        { provide: TRADE_MARKET_DATA_PORT, useValue: marketData },
        {
          provide: InstrumentApiService,
          useValue: {
            getCandles: (instrumentId: string, from?: string, to?: string) => {
              requestedInstrumentId = instrumentId;
              requestedDateRange = { from: from ?? null, to: to ?? null };
              return candleRequest();
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(AssetPopupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('symbol', symbol);
    fixture.detectChanges();
  }

  function changeElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.asset-price-change')!;
  }

  beforeEach(() => {
    asset = {
      instrumentId: 'instrument-aapl',
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      instrumentType: 'equity',
      basePrice: 100,
    };
    price = 110;
    requestedInstrumentId = null;
    requestedDateRange = null;
    candleRequest = async () => [];
  });

  afterEach(() => fixture.destroy());

  it('uses the previous close and current price to calculate the change', () => {
    create();

    expect(component.changeAmount()).toBeCloseTo(10, 6);
    expect(component.changePct()).toBeCloseTo(10, 6);
    expect(changeElement().textContent?.replace(/\s+/g, ' ').trim()).toBe('+$10.00 (+10.00%)');
    expect(changeElement().classList).toContain('positive');
  });

  it('shows a negative change from the previous close', () => {
    price = 95;
    create();

    expect(component.changePct()).toBeCloseTo(-5, 6);
    expect(changeElement().classList).toContain('negative');
  });

  it.each([
    ['exactly 0', 100],
    ['+0.004', 100.004],
    ['-0.004', 99.996],
  ])('shows a change of %s as flat: no sign, neutral style', (_label, flatPrice) => {
    price = flatPrice;
    create();

    expect(component.isFlat()).toBe(true);
    expect(changeElement().textContent?.replace(/\s+/g, ' ').trim()).toBe('$0.00 (0.00%)');
    expect(changeElement().classList).toContain('neutral');
    expect(changeElement().classList).not.toContain('positive');
    expect(changeElement().classList).not.toContain('negative');
  });

  it('is not flat when under a cent moves a cheap asset by a visible percent', () => {
    asset = {
      instrumentId: 'instrument-ada',
      symbol: 'ADA',
      name: 'Cardano',
      currency: 'USD',
      instrumentType: 'crypto',
      basePrice: 0.42,
    };
    price = 0.424;
    create('ADA');

    expect(component.isFlat()).toBe(false);
    expect(changeElement().textContent?.replace(/\s+/g, ' ').trim()).toBe('+$0.00 (+0.95%)');
    expect(changeElement().classList).toContain('positive');
  });

  it('shows an unavailable price when the quote is missing', () => {
    price = null;
    create();

    expect(fixture.nativeElement.textContent).toContain('Price unavailable');
    expect(component.hasPriceChange()).toBe(false);
  });

  it('loads candle history for the selected instrument and shows the empty state', async () => {
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(requestedInstrumentId).toBe('instrument-aapl');
    expect(requestedDateRange).toEqual(assetPriceRangeFor('1M'));
    expect(component.selectedPriceInterval()).toBe('1M');
    expect(fixture.nativeElement.textContent).toContain('No price history is available');
  });

  it.each([
    ['1W', '2026-10-21'],
    ['1M', '2026-09-28'],
    ['1Y', '2025-10-28'],
    ['YTD', '2026-01-01'],
    ['ALL', '2021-10-28'],
  ] as const)('calculates the %s request window', (interval, from) => {
    expect(assetPriceRangeFor(interval, new Date('2026-10-28T15:00:00Z'))).toEqual({
      from,
      to: '2026-10-28',
    });
  });

  it('clamps a one-month window to the last valid day of the previous month', () => {
    expect(assetPriceRangeFor('1M', new Date('2026-03-31T12:00:00Z'))).toEqual({
      from: '2026-02-28',
      to: '2026-03-31',
    });
  });

  it('requests a new date window when another interval is selected', async () => {
    create();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('.interval-tab')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(requestedDateRange).toEqual(assetPriceRangeFor('1W'));
    expect(component.selectedPriceInterval()).toBe('1W');
  });

  it('colours the price chart by the plotted range, not the previous close', async () => {
    candleRequest = async () => [
      {
        date: '2025-03-04',
        open: 100,
        high: 108,
        low: 96,
        close: 104,
        volume: 2400,
        currency: 'USD',
      },
      {
        date: '2025-03-05',
        open: 90,
        high: 94,
        low: 86,
        close: 88,
        volume: 1800,
        currency: 'USD',
      },
    ];
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.changePct()).toBeCloseTo(10, 6);
    expect(component.priceTrend()).toBe('down');
  });

  it('plots the average of each candle OHLC as a line-chart point', () => {
    expect(
      toAveragePricePoints([
        {
          date: '2025-03-04',
          open: 100,
          high: 108,
          low: 96,
          close: 104,
          volume: 2400,
          currency: 'USD',
        },
      ]),
    ).toEqual([{ label: 'Mar 4', value: 102 }]);
  });

  it('shows a loading state while candle history is pending', () => {
    candleRequest = () => new Promise(() => undefined);
    create();

    expect(fixture.nativeElement.textContent).toContain('Loading price history');
  });

  it('shows an error state when candle history cannot be loaded', async () => {
    candleRequest = async () => {
      throw new Error('request failed');
    };
    create();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      "Price history couldn't be loaded",
    );
  });

  it('does not replace the current asset state with a stale candle response', async () => {
    let resolveOldRequest!: (candles: InstrumentCandleResponse[]) => void;
    let resolveNewRequest!: (candles: InstrumentCandleResponse[]) => void;
    let requestCount = 0;
    candleRequest = () =>
      new Promise((resolve) => {
        requestCount += 1;
        if (requestCount === 1) {
          resolveOldRequest = resolve;
        } else {
          resolveNewRequest = resolve;
        }
      });
    create();

    asset = {
      instrumentId: 'instrument-msft',
      symbol: 'MSFT',
      name: 'Microsoft',
      currency: 'USD',
      instrumentType: 'equity',
      basePrice: 100,
    };
    fixture.componentRef.setInput('symbol', 'MSFT');
    fixture.detectChanges();
    await fixture.whenStable();

    resolveOldRequest([
      {
        date: '2025-01-01',
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 100,
        currency: 'USD',
      },
    ]);
    resolveNewRequest([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(requestedInstrumentId).toBe('instrument-msft');
    expect(component.candleState()).toBe('ready');
    expect(component.candles()).toEqual([]);
  });
});
