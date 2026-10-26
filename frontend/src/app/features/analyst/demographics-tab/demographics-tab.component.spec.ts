import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SegmentSummaryResponse } from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { SegmentBarChartComponent } from '../segment-bar-chart/segment-bar-chart.component';
import {
  SegmentBarChartStubComponent,
  flushPromises,
  instrument,
  page,
  unavailable,
} from '../testing/analyst-testing';
import { DemographicsTabComponent } from './demographics-tab.component';

const AGE_BAND_SEGMENTS: SegmentSummaryResponse[] = [
  {
    segment: '25-34',
    portfolioCount: 2,
    marketValueUsd: 3000,
    averageReturnYtd: 0.1,
    classes: [
      { instrumentClass: 'EQUITY', exposureUsd: 1500, holderCount: 2 },
      { instrumentClass: 'CRYPTO', exposureUsd: 500, holderCount: 1 },
    ],
  },
  {
    segment: '35-44',
    portfolioCount: 1,
    marketValueUsd: 1000,
    averageReturnYtd: -0.05,
    classes: [{ instrumentClass: 'EQUITY', exposureUsd: 800, holderCount: 1 }],
  },
];

describe('DemographicsTabComponent', () => {
  let fixture: ComponentFixture<DemographicsTabComponent>;
  let component: DemographicsTabComponent;

  const analyticsApi = {
    getSegments: vi.fn(),
    getSegmentExposure: vi.fn(),
    listInstruments: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    analyticsApi.getSegments.mockResolvedValue(AGE_BAND_SEGMENTS);
    analyticsApi.getSegmentExposure.mockResolvedValue([
      { segment: '25-34', exposureUsd: 500, holderCount: 1, segmentTotalUsd: 2000 },
    ]);
    analyticsApi.listInstruments.mockResolvedValue(page([instrument()]));

    await TestBed.configureTestingModule({
      imports: [DemographicsTabComponent],
      providers: [provideRouter([]), { provide: AnalyticsApiService, useValue: analyticsApi }],
    })
      .overrideComponent(DemographicsTabComponent, {
        remove: { imports: [SegmentBarChartComponent] },
        add: { imports: [SegmentBarChartStubComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DemographicsTabComponent);
    component = fixture.componentInstance;
    await settle();
  });

  async function settle() {
    fixture.detectChanges();
    await flushPromises();
    fixture.detectChanges();
  }

  it('groups by age band and shows each group’s class mix as shares', () => {
    expect(analyticsApi.getSegments).toHaveBeenCalledWith('ageBand');
    expect(component.chartLabels()).toEqual(['25-34', '35-44']);
    const equity = component.chartDatasets().find((dataset) => dataset.label === 'Equity')!;
    expect(equity.data).toEqual([0.75, 1]);
  });

  it('opens the first group’s top holdings', () => {
    expect(component.selectedSegment()).toBe('25-34');
    expect(analyticsApi.listInstruments).toHaveBeenCalledWith(
      expect.objectContaining({ ageBand: '25-34', sort: 'exposure', direction: 'desc', size: 5 }),
    );
    expect(fixture.nativeElement.querySelector('.top-list').textContent).toContain('AAPL');
  });

  it('loads the groups again by country', async () => {
    analyticsApi.getSegments.mockResolvedValue([{ ...AGE_BAND_SEGMENTS[0], segment: 'USA' }]);

    component.changeDimension('country');
    await settle();

    expect(analyticsApi.getSegments).toHaveBeenLastCalledWith('country');
    expect(component.selectedSegment()).toBe('USA');
    expect(analyticsApi.listInstruments).toHaveBeenLastCalledWith(
      expect.objectContaining({ country: 'USA' }),
    );
  });

  it('shows each group’s share in a focused class, and only that class in its top holdings', async () => {
    component.changeFocus('class:CRYPTO');
    await settle();

    expect(analyticsApi.getSegmentExposure).toHaveBeenCalledWith('ageBand', {
      instrumentClass: 'CRYPTO',
    });
    expect(component.chartDatasets()).toEqual([
      expect.objectContaining({ label: 'Crypto', data: [0.25, 0] }),
    ]);
    expect(analyticsApi.listInstruments).toHaveBeenLastCalledWith(
      expect.objectContaining({ ageBand: '25-34', instrumentClass: 'CRYPTO' }),
    );
  });

  it('loads a group’s top holdings when its bar or row is clicked', async () => {
    await component.selectSegment('35-44');

    expect(analyticsApi.listInstruments).toHaveBeenLastCalledWith(
      expect.objectContaining({ ageBand: '35-44' }),
    );
  });

  it('sorts the table by a numeric column, biggest first', () => {
    const portfolios = component.columns().find((column) => column.key === 'portfolioCount')!;

    component.sortBy(portfolios);

    expect(component.sortedRows().map((row) => row.segment)).toEqual(['25-34', '35-44']);
    component.sortBy(portfolios);
    expect(component.sortedRows().map((row) => row.segment)).toEqual(['35-44', '25-34']);
  });

  it('shows the unavailable message when analytics is down (503)', async () => {
    analyticsApi.getSegments.mockRejectedValue(unavailable());

    void component.load();
    await settle();

    expect(component.state()).toBe('unavailable');
  });
});
