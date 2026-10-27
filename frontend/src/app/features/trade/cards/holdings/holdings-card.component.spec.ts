import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TRADE_MARKET_DATA_PORT,
  TradeMarketAsset,
} from '@features/trade/services/trade-market-data.port';
import { HoldingsCardComponent } from './holdings-card.component';

describe('HoldingsCardComponent change display', () => {
  let fixture: ComponentFixture<HoldingsCardComponent>;
  const asset: TradeMarketAsset = {
    symbol: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    instrumentType: 'equity',
    basePrice: 100,
  };

  function renderChange(price: number): HTMLElement {
    TestBed.configureTestingModule({
      imports: [HoldingsCardComponent],
      providers: [
        provideRouter([]),
        {
          provide: TRADE_MARKET_DATA_PORT,
          useValue: {
            listAssets: () => [asset],
            getAsset: () => asset,
            getPrice: () => price,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(HoldingsCardComponent);
    fixture.componentRef.setInput('holdings', [
      { symbol: 'AAPL', instrumentType: 'equity', quantity: 1 },
    ]);
    // Only the holding row; cash rows have their own fixed 0.00%.
    fixture.componentInstance.instrument.set('equity');
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.change')!;
  }

  afterEach(() => fixture.destroy());

  it.each([
    ['exactly 0', 100],
    ['+0.004%', 100.004],
    ['-0.004%', 99.996],
  ])('shows a change of %s as flat 0.00% with no sign or colour', (_label, price) => {
    const change = renderChange(price);

    expect(change.textContent?.trim()).toBe('0.00%');
    expect(change.classList).not.toContain('positive');
    expect(change.classList).not.toContain('negative');
  });

  it('shows a visible gain with a plus sign', () => {
    const change = renderChange(110);

    expect(change.textContent?.trim()).toBe('+10.00%');
    expect(change.classList).toContain('positive');
  });

  it('shows a visible loss without a plus sign', () => {
    const change = renderChange(95);

    expect(change.textContent?.trim()).toBe('-5.00%');
    expect(change.classList).toContain('negative');
  });
});
