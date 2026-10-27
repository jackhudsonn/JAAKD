import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { LineChartComponent } from '@shared/components/line-chart/line-chart.component';
import { PieChartComponent } from '@shared/components/pie-chart/pie-chart.component';
import { rangeFor } from '../analyst-format';
import {
  LineChartStubComponent,
  PieChartStubComponent,
  flushPromises,
  holding,
} from '../testing/analyst-testing';
import { PortfolioDetailComponent } from './portfolio-detail.component';

describe('PortfolioDetailComponent', () => {
  let fixture: ComponentFixture<PortfolioDetailComponent>;
  let component: PortfolioDetailComponent;

  const analyticsApi = {
    getPortfolio: vi.fn(),
    getPortfolioHoldings: vi.fn(),
    getPortfolioSeries: vi.fn(),
    getPortfolioClassSeries: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    analyticsApi.getPortfolio.mockResolvedValue({
      portfolioId: 'portfolio-1',
      userId: 'user-1',
      country: 'USA',
      ageBand: '25-34',
      marketValueUsd: 1500,
      return1w: null,
      return1m: null,
      return3m: null,
      returnYtd: 0.05,
      volatilityAnn: null,
      maxDrawdown: null,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 100,
    });
    analyticsApi.getPortfolioHoldings.mockResolvedValue([
      holding(),
      holding({
        holdingId: 'holding-2',
        ticker: 'BTC',
        name: 'Bitcoin',
        instrumentClass: 'CRYPTO',
        marketValueUsd: 500,
      }),
    ]);
    analyticsApi.getPortfolioSeries.mockResolvedValue([
      {
        date: '2026-10-22',
        marketValueUsd: 1400,
        cashUsd: 0,
        netExternalFlowUsd: 0,
        dailyReturn: null,
        cumulativeTwr: 0,
      },
      {
        date: '2026-10-23',
        marketValueUsd: 1500,
        cashUsd: 0,
        netExternalFlowUsd: 0,
        dailyReturn: 0.07,
        cumulativeTwr: 0.07,
      },
    ]);
    analyticsApi.getPortfolioClassSeries.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [PortfolioDetailComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsApiService, useValue: analyticsApi },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ portfolioId: 'portfolio-1' })) },
        },
      ],
    })
      .overrideComponent(PortfolioDetailComponent, {
        remove: { imports: [LineChartComponent, PieChartComponent] },
        add: { imports: [LineChartStubComponent, PieChartStubComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PortfolioDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await flushPromises();
    fixture.detectChanges();
  });

  it('loads the portfolio, its holdings and a year of history', () => {
    expect(analyticsApi.getPortfolio).toHaveBeenCalledWith('portfolio-1');
    expect(analyticsApi.getPortfolioHoldings).toHaveBeenCalledWith('portfolio-1');
    expect(analyticsApi.getPortfolioSeries).toHaveBeenCalledWith('portfolio-1', rangeFor('1Y'));
    expect(component.rangeReturn()).toBeCloseTo(0.07);
  });

  it('loads the series again when the range changes', async () => {
    component.range.set('1M');
    fixture.detectChanges();
    await flushPromises();

    expect(analyticsApi.getPortfolioSeries).toHaveBeenLastCalledWith('portfolio-1', rangeFor('1M'));
    expect(component.seriesState()).toBe('ready');
  });

  it('narrows the holdings, pie and charts to a chosen class', async () => {
    component.selectClass('CRYPTO');
    fixture.detectChanges();
    await flushPromises();

    expect(component.visibleHoldings().map((row) => row.ticker)).toEqual(['BTC']);
    expect(component.pieSlices().map((slice) => slice.label)).toEqual(['BTC']);
    expect(analyticsApi.getPortfolioClassSeries).toHaveBeenCalledWith(
      'portfolio-1',
      'CRYPTO',
      rangeFor('1Y'),
    );
    expect(component.chartClass()).toBe('CRYPTO');
  });

  it('goes back to the whole portfolio when the class is chosen again', () => {
    component.selectClass('CRYPTO');
    component.selectClass('CRYPTO');

    expect(component.selectedClass()).toBeNull();
    expect(component.visibleHoldings()).toHaveLength(2);
  });

  it('selects a class from its pie slice', () => {
    component.onSliceClick({ label: 'Crypto', value: 500, color: '#E67E22' });

    expect(component.selectedClass()).toBe('CRYPTO');
  });

  it('sorts holdings biggest first, then flips on a second click', () => {
    expect(component.visibleHoldings().map((row) => row.ticker)).toEqual(['AAPL', 'BTC']);

    const marketValue = component.holdingColumns.find((col) => col.key === 'marketValueUsd')!;
    component.sortHoldings(marketValue);

    expect(component.visibleHoldings().map((row) => row.ticker)).toEqual(['BTC', 'AAPL']);
  });
});
