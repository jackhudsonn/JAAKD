import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TRADE_MARKET_DATA_PORT,
  TradeMarketAsset,
} from '@features/trade/services/trade-market-data.port';
import { AssetPopupComponent } from './asset-popup.component';

describe('AssetPopupComponent', () => {
  let fixture: ComponentFixture<AssetPopupComponent>;
  let component: AssetPopupComponent;

  let asset: TradeMarketAsset | undefined;
  let price: number | null;

  const marketData = {
    getAsset: () => asset,
    getPrice: () => price,
  };

  function create() {
    TestBed.configureTestingModule({
      imports: [AssetPopupComponent],
      providers: [{ provide: TRADE_MARKET_DATA_PORT, useValue: marketData }],
    });

    fixture = TestBed.createComponent(AssetPopupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
  }

  function changeElement(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.asset-price-change')!;
  }

  beforeEach(() => {
    asset = {
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      instrumentType: 'equity',
      basePrice: 100,
    };
    price = 110;
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
      symbol: 'ADA',
      name: 'Cardano',
      currency: 'USD',
      instrumentType: 'crypto',
      basePrice: 0.42,
    };
    price = 0.424;
    create();

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
});
