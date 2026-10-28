import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TRADE_MARKET_DATA_PORT,
  TradeMarketAsset,
} from '@features/trade/services/trade-market-data.port';
import { InstrumentApiService } from '@core/services/instrument-api.service';
import { InstrumentCandleResponse } from '@core/models/api.models';
import { AssetPopupComponent, toAveragePricePoints } from './asset-popup.component';

describe('AssetPopupComponent', () => {
  let fixture: ComponentFixture<AssetPopupComponent>;
  let component: AssetPopupComponent;

  let asset: TradeMarketAsset | undefined;
  let price: number | null;
  let candleRequest: () => Promise<InstrumentCandleResponse[]>;
  let requestedInstrumentId: string | null;

  const marketData = {
    getAsset: (symbol: string) => asset?.symbol === symbol ? asset : undefined,
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
            getCandles: (instrumentId: string) => {
              requestedInstrumentId = instrumentId;
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
    expect(fixture.nativeElement.textContent).toContain('No price history is available');
  });

  it('plots the average of each candle OHLC as a line-chart point', () => {
    expect(toAveragePricePoints([
      {
        date: '2025-03-04',
        open: 100,
        high: 108,
        low: 96,
        close: 104,
        volume: 2400,
        currency: 'USD',
      },
    ])).toEqual([{ label: '2025-03-04', value: 102 }]);
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
