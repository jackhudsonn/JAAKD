import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InstrumentClass } from '@core/models/api.models';
import {
  ClassSummaryResponse,
  InstrumentPerformanceResponse,
  InstrumentSort,
  SegmentFilter,
  SortDirection,
} from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { AuditPageResponse } from '@core/services/audit-api.service';
import { PieChartComponent, PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import {
  CLASS_LABELS,
  INSTRUMENT_CLASSES,
  classForLabel,
  classSlices,
  formatPercent,
  formatUsd,
  signClass,
  sortIndicator,
  topSlices,
} from '../analyst-format';
import { LoadState, keepsContent, loadStateFor } from '../analyst-load-state';
import { LoadStateMessageComponent } from '../load-state-message/load-state-message.component';
import { SegmentFiltersComponent } from '../segment-filters/segment-filters.component';

interface Column {
  sort: InstrumentSort;
  label: string;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  { sort: 'ticker', label: 'Ticker', numeric: false },
  { sort: 'name', label: 'Name', numeric: false },
  { sort: 'instrumentClass', label: 'Class', numeric: false },
  { sort: 'lastClose', label: 'Last close', numeric: true },
  { sort: 'return1w', label: '1W', numeric: true },
  { sort: 'return1m', label: '1M', numeric: true },
  { sort: 'return3m', label: '3M', numeric: true },
  { sort: 'returnYtd', label: 'YTD', numeric: true },
  { sort: 'volatility', label: 'Volatility', numeric: true },
  { sort: 'maxDrawdown', label: 'Max drawdown', numeric: true },
  { sort: 'holders', label: 'Holders', numeric: true },
  { sort: 'exposure', label: 'Exposure', numeric: true },
  { sort: 'netFlow30d', label: 'Net flow 30d', numeric: true },
];

const PAGE_SIZE = 25;
// Wait this long after the last keystroke before searching, so typing "apple" sends one request, not five.
const SEARCH_DELAY_MS = 300;

@Component({
  selector: 'app-instruments-tab',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PieChartComponent,
    WidgetCardComponent,
    LoadStateMessageComponent,
    SegmentFiltersComponent,
  ],
  templateUrl: './instruments-tab.component.html',
  styleUrls: ['../analyst.css', './instruments-tab.component.css'],
})
export class InstrumentsTabComponent implements OnInit, OnDestroy {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly router = inject(Router);

  readonly columns = COLUMNS;
  readonly classes = INSTRUMENT_CLASSES;
  readonly classLabels = CLASS_LABELS;
  readonly formatUsd = formatUsd;
  readonly formatPercent = formatPercent;
  readonly signClass = signClass;
  readonly keepsContent = keepsContent;

  // The filters. instrumentClass is shared by the class dropdown, the class cards, the pie and the table, so
  // choosing a class in any of them updates all of them.
  readonly segment = signal<SegmentFilter>({});
  readonly instrumentClass = signal<InstrumentClass | null>(null);
  readonly search = signal('');

  readonly summaryState = signal<LoadState>('loading');
  readonly summary = signal<ClassSummaryResponse[]>([]);

  // What the pie shows, and for which class. Set only once the data has arrived, so the chart animates from the
  // old slices to the new ones instead of being torn down while loading.
  readonly pieSlices = signal<PieChartSlice[]>([]);
  readonly pieClass = signal<InstrumentClass | null>(null);
  readonly pieState = signal<LoadState>('loading');
  private classInstruments: InstrumentPerformanceResponse[] = [];
  private pieRequest = 0;

  readonly tableState = signal<LoadState>('loading');
  readonly page = signal<AuditPageResponse<InstrumentPerformanceResponse> | null>(null);
  readonly sort = signal<InstrumentSort>('exposure');
  readonly direction = signal<SortDirection>('desc');
  readonly pageIndex = signal(0);
  private pageRequest = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly segmentLabel = computed(() => {
    const { country, ageBand } = this.segment();
    const parts = [country, ageBand ? `age ${ageBand}` : undefined].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'all retail portfolios';
  });

  ngOnInit() {
    void this.loadSummary();
    void this.loadPage();
  }

  ngOnDestroy() {
    clearTimeout(this.searchTimer);
  }

  async loadSummary() {
    this.summaryState.set('loading');
    try {
      this.summary.set(await this.analyticsApi.getSummary(this.segment()));
      this.summaryState.set('ready');
      await this.loadPie();
    } catch (error) {
      this.summaryState.set(loadStateFor(error));
    }
  }

  // No class: one slice per class, from the summary. A class: its biggest holdings.
  async loadPie() {
    const instrumentClass = this.instrumentClass();
    const request = ++this.pieRequest;
    if (!instrumentClass) {
      this.pieSlices.set(
        classSlices(
          this.summary().map((row) => ({
            instrumentClass: row.instrumentClass,
            value: row.exposureUsd,
          })),
        ),
      );
      this.pieClass.set(null);
      this.pieState.set('ready');
      return;
    }

    this.pieState.set('loading');
    try {
      const page = await this.analyticsApi.listInstruments({
        ...this.segment(),
        instrumentClass,
        sort: 'exposure',
        direction: 'desc',
        size: 100,
      });
      if (request === this.pieRequest) {
        this.classInstruments = page.content;
        this.pieSlices.set(
          topSlices(
            page.content,
            (instrument) => instrument.ticker,
            (instrument) => instrument.exposureUsd,
            instrumentClass,
          ),
        );
        this.pieClass.set(instrumentClass);
        this.pieState.set('ready');
      }
    } catch (error) {
      if (request === this.pieRequest) {
        this.pieState.set(loadStateFor(error));
      }
    }
  }

  async loadPage() {
    // Only the latest request may update the table, so quick clicks can't show an older sort's rows.
    const request = ++this.pageRequest;
    this.tableState.set('loading');
    try {
      const page = await this.analyticsApi.listInstruments({
        ...this.segment(),
        instrumentClass: this.instrumentClass() ?? undefined,
        search: this.search(),
        sort: this.sort(),
        direction: this.direction(),
        page: this.pageIndex(),
        size: PAGE_SIZE,
      });
      if (request === this.pageRequest) {
        this.page.set(page);
        this.tableState.set('ready');
      }
    } catch (error) {
      if (request === this.pageRequest) {
        this.tableState.set(loadStateFor(error));
      }
    }
  }

  changeSegment(segment: SegmentFilter) {
    this.segment.set(segment);
    this.pageIndex.set(0);
    void this.loadSummary();
    void this.loadPage();
  }

  // From the dropdown, a class card, a pie slice or "All classes". Choosing the selected class again clears it.
  selectClass(instrumentClass: InstrumentClass | null) {
    const next = instrumentClass === this.instrumentClass() ? null : instrumentClass;
    this.instrumentClass.set(next);
    this.pageIndex.set(0);
    void this.loadPie();
    void this.loadPage();
  }

  // A class slice selects the class; an instrument slice opens the instrument's page.
  onSliceClick(slice: PieChartSlice) {
    if (!this.pieClass()) {
      const instrumentClass = classForLabel(slice.label);
      if (instrumentClass) {
        this.selectClass(instrumentClass);
      }
      return;
    }
    const instrument = this.classInstruments.find((row) => row.ticker === slice.label);
    if (instrument) {
      this.open(instrument);
    }
  }

  changeSearch(search: string) {
    this.search.set(search);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.pageIndex.set(0);
      void this.loadPage();
    }, SEARCH_DELAY_MS);
  }

  // Clicking the sorted column flips the direction; a new column starts with the biggest values first
  // (or A→Z for text columns).
  sortBy(column: Column) {
    if (this.sort() === column.sort) {
      this.direction.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sort.set(column.sort);
      this.direction.set(column.numeric ? 'desc' : 'asc');
    }
    this.pageIndex.set(0);
    void this.loadPage();
  }

  goToPage(pageIndex: number) {
    this.pageIndex.set(pageIndex);
    void this.loadPage();
  }

  open(instrument: InstrumentPerformanceResponse) {
    void this.router.navigate(['/analyst/instruments', instrument.instrumentId]);
  }

  sortIndicator(column: Column): string {
    return sortIndicator(this.sort() === column.sort, this.direction());
  }
}
