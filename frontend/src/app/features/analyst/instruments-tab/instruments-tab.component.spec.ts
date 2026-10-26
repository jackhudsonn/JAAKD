import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { PieChartComponent } from '@shared/components/pie-chart/pie-chart.component';
import {
  PieChartStubComponent,
  flushPromises,
  instrument,
  page,
  unavailable,
} from '../testing/analyst-testing';
import { InstrumentsTabComponent } from './instruments-tab.component';

describe('InstrumentsTabComponent', () => {
  let fixture: ComponentFixture<InstrumentsTabComponent>;
  let component: InstrumentsTabComponent;

  const analyticsApi = {
    getSummary: vi.fn(),
    listInstruments: vi.fn(),
    getCountries: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    analyticsApi.getSummary.mockResolvedValue([
      {
        instrumentClass: 'EQUITY',
        instrumentCount: 1,
        positionCount: 2,
        exposureUsd: 1000,
        averageReturn1m: 0.02,
      },
    ]);
    analyticsApi.listInstruments.mockResolvedValue(page([instrument()]));
    analyticsApi.getCountries.mockResolvedValue(['USA']);

    await TestBed.configureTestingModule({
      imports: [InstrumentsTabComponent],
      providers: [provideRouter([]), { provide: AnalyticsApiService, useValue: analyticsApi }],
    })
      .overrideComponent(InstrumentsTabComponent, {
        remove: { imports: [PieChartComponent] },
        add: { imports: [PieChartStubComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(InstrumentsTabComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function render() {
    fixture.detectChanges();
    await flushPromises();
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function lastQuery() {
    return analyticsApi.listInstruments.mock.calls.at(-1)![0];
  }

  it('loads the summary and the first page, biggest exposure first', async () => {
    await render();

    expect(analyticsApi.getSummary).toHaveBeenCalledWith({});
    expect(lastQuery()).toEqual(
      expect.objectContaining({ sort: 'exposure', direction: 'desc', page: 0, size: 25 }),
    );
    expect(text()).toContain('Apple Inc');
  });

  it('loads again when a column is sorted, and flips the direction on a second click', async () => {
    await render();
    const returnYtd = component.columns.find((column) => column.sort === 'returnYtd')!;

    component.sortBy(returnYtd);
    expect(lastQuery()).toEqual(expect.objectContaining({ sort: 'returnYtd', direction: 'desc' }));

    component.sortBy(returnYtd);
    expect(lastQuery()).toEqual(expect.objectContaining({ sort: 'returnYtd', direction: 'asc' }));
  });

  it('sorts text columns A to Z first', async () => {
    await render();

    component.sortBy(component.columns.find((column) => column.sort === 'ticker')!);

    expect(lastQuery()).toEqual(expect.objectContaining({ sort: 'ticker', direction: 'asc' }));
  });

  it('filters the table by class and goes back to the first page', async () => {
    await render();
    component.goToPage(2);

    component.selectClass('CRYPTO');

    expect(component.pageIndex()).toBe(0);
    expect(analyticsApi.listInstruments).toHaveBeenCalledWith(
      expect.objectContaining({ instrumentClass: 'CRYPTO', page: 0, size: 25 }),
    );
  });

  it('clears the class when the selected class is chosen again', async () => {
    await render();
    component.selectClass('CRYPTO');

    component.selectClass('CRYPTO');

    expect(component.instrumentClass()).toBeNull();
    expect(lastQuery().instrumentClass).toBeUndefined();
  });

  it('reloads the summary and the table for a country or age band', async () => {
    await render();

    component.changeSegment({ country: 'USA', ageBand: '25-34' });

    expect(analyticsApi.getSummary).toHaveBeenLastCalledWith({ country: 'USA', ageBand: '25-34' });
    expect(lastQuery()).toEqual(expect.objectContaining({ country: 'USA', ageBand: '25-34' }));
  });

  it('searches once typing pauses, not on every keystroke', async () => {
    await render();
    vi.useFakeTimers();
    const callsBefore = analyticsApi.listInstruments.mock.calls.length;

    component.changeSearch('a');
    component.changeSearch('ap');
    component.changeSearch('app');
    await vi.advanceTimersByTimeAsync(299);
    expect(analyticsApi.listInstruments.mock.calls.length).toBe(callsBefore);

    await vi.advanceTimersByTimeAsync(1);
    expect(analyticsApi.listInstruments.mock.calls.length).toBe(callsBefore + 1);
    expect(lastQuery()).toEqual(expect.objectContaining({ search: 'app', page: 0 }));
  });

  it('keeps only the latest response when sorts are clicked quickly', async () => {
    await render();
    let resolveSlow!: (value: unknown) => void;
    analyticsApi.listInstruments
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce(page([instrument({ ticker: 'NEW', name: 'Newer sort' })]));

    component.sortBy(component.columns.find((column) => column.sort === 'return1w')!);
    component.sortBy(component.columns.find((column) => column.sort === 'return1m')!);
    await flushPromises();
    resolveSlow(page([instrument({ ticker: 'OLD', name: 'Older sort' })]));
    await flushPromises();

    expect(component.page()!.content[0].ticker).toBe('NEW');
  });

  it('says when no instruments match', async () => {
    analyticsApi.listInstruments.mockResolvedValue(page([]));

    await render();

    expect(text()).toContain('No instruments match these filters.');
  });

  it('shows the unavailable message when analytics is down (503)', async () => {
    analyticsApi.getSummary.mockRejectedValue(unavailable());
    analyticsApi.listInstruments.mockRejectedValue(unavailable());

    await render();

    expect(component.tableState()).toBe('unavailable');
    expect(text()).toContain('Analytics is temporarily unavailable');
  });
});
