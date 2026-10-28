import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { InstrumentClass } from '@core/models/api.models';
import {
  ClassValuePoint,
  HoldingSnapshotResponse,
  PortfolioPerformanceResponse,
  PortfolioValuePoint,
  SortDirection,
} from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import {
  LineChartComponent,
  LineChartPoint,
} from '@shared/components/line-chart/line-chart.component';
import { PieChartComponent, PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import {
  CLASS_LABELS,
  RANGE_OPTIONS,
  RangeKey,
  classForLabel,
  classSlices,
  formatPercent,
  formatQuantity,
  formatUsd,
  rangeFor,
  rebaseCumulative,
  shortId,
  signClass,
  sortIndicator,
  sortRows,
  topSlices,
} from '../analyst-format';
import { toDateChartPoints } from '@shared/utils/chart-date-label';
import { trendForFraction, trendForValue } from '@shared/utils/format-percentage-change';
import { LoadState, keepsContent, loadStateFor } from '../analyst-load-state';
import { LoadStateMessageComponent } from '../load-state-message/load-state-message.component';

type HoldingSortKey =
  | 'ticker'
  | 'name'
  | 'instrumentClass'
  | 'quantity'
  | 'costBasisUsd'
  | 'marketValueUsd'
  | 'realizedPnlToDateUsd'
  | 'unrealizedPnlUsd';

interface HoldingColumn {
  key: HoldingSortKey;
  label: string;
  numeric: boolean;
}

const HOLDING_COLUMNS: HoldingColumn[] = [
  { key: 'ticker', label: 'Ticker', numeric: false },
  { key: 'name', label: 'Name', numeric: false },
  { key: 'instrumentClass', label: 'Class', numeric: false },
  { key: 'quantity', label: 'Quantity', numeric: true },
  { key: 'costBasisUsd', label: 'Cost basis', numeric: true },
  { key: 'marketValueUsd', label: 'Market value', numeric: true },
  { key: 'realizedPnlToDateUsd', label: 'Realized P&L', numeric: true },
  { key: 'unrealizedPnlUsd', label: 'Unrealized P&L', numeric: true },
];

@Component({
  selector: 'app-portfolio-detail',
  standalone: true,
  imports: [
    RouterLink,
    LineChartComponent,
    PieChartComponent,
    WidgetCardComponent,
    LoadStateMessageComponent,
  ],
  templateUrl: './portfolio-detail.component.html',
  styleUrls: ['../analyst.css', './portfolio-detail.component.css'],
})
export class PortfolioDetailComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly router = inject(Router);

  readonly rangeOptions = RANGE_OPTIONS;
  readonly classLabels = CLASS_LABELS;
  readonly holdingColumns = HOLDING_COLUMNS;
  readonly formatUsd = formatUsd;
  readonly formatPercent = formatPercent;
  readonly formatQuantity = formatQuantity;
  readonly signClass = signClass;
  readonly trendForValue = trendForValue;
  readonly trendForFraction = trendForFraction;
  readonly shortId = shortId;
  readonly keepsContent = keepsContent;

  readonly portfolioId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('portfolioId') ?? '')),
    { initialValue: '' },
  );
  readonly range = signal<RangeKey>('1Y');
  // null = the whole portfolio; a class narrows the holdings table and the charts to that class.
  readonly selectedClass = signal<InstrumentClass | null>(null);

  readonly state = signal<LoadState>('loading');
  readonly portfolio = signal<PortfolioPerformanceResponse | null>(null);
  readonly holdingsState = signal<LoadState>('loading');
  readonly holdings = signal<HoldingSnapshotResponse[]>([]);
  readonly seriesState = signal<LoadState>('loading');
  readonly series = signal<PortfolioValuePoint[]>([]);
  readonly classSeries = signal<ClassValuePoint[]>([]);
  // The class the charts currently show (null: whole portfolio). It changes only when that class's data has
  // arrived, so switching class keeps the old charts (dimmed) instead of flashing an empty state.
  readonly chartClass = signal<InstrumentClass | null>(null);
  readonly chartsLoaded = signal(false);
  private seriesRequest = 0;

  readonly holdingSort = signal<HoldingSortKey>('marketValueUsd');
  readonly holdingDirection = signal<SortDirection>('desc');

  // Market value per class (cash included: it's part of the portfolio).
  readonly classBreakdown = computed(() => {
    const totals = new Map<InstrumentClass, number>();
    for (const holding of this.holdings()) {
      totals.set(
        holding.instrumentClass,
        (totals.get(holding.instrumentClass) ?? 0) + (holding.marketValueUsd ?? 0),
      );
    }
    return [...totals].map(([instrumentClass, value]) => ({ instrumentClass, value }));
  });
  // No class: one slice per class. A class: its biggest holdings. Same chart either way, so it animates.
  readonly pieSlices = computed<PieChartSlice[]>(() => {
    const selectedClass = this.selectedClass();
    if (!selectedClass) {
      return classSlices(this.classBreakdown());
    }
    return topSlices(
      this.holdings().filter((holding) => holding.instrumentClass === selectedClass),
      (holding) => holding.ticker,
      (holding) => holding.marketValueUsd,
      selectedClass,
    );
  });
  readonly heldClasses = computed(() =>
    [...this.classBreakdown()]
      .sort((a, b) => b.value - a.value)
      .map((entry) => entry.instrumentClass),
  );

  readonly visibleHoldings = computed(() => {
    const selectedClass = this.selectedClass();
    const rows = selectedClass
      ? this.holdings().filter((holding) => holding.instrumentClass === selectedClass)
      : this.holdings();
    const key = this.holdingSort();
    return sortRows(rows, (holding) => holding[key], this.holdingDirection());
  });

  // Whole portfolio: value and time-weighted return.
  readonly valuePoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.series().map((point) => ({ date: point.date, value: point.marketValueUsd })),
    ),
  );
  readonly returnPoints = computed(() =>
    rebaseCumulative(
      this.series().map((point) => ({ date: point.date, value: point.cumulativeTwr })),
    ),
  );
  readonly rangeReturn = computed(() => this.returnPoints().at(-1)?.value ?? null);

  // One class: market value against cost basis, and P&L. Days without a price are skipped on both lines.
  private readonly pricedClassPoints = computed(() =>
    this.classSeries().filter(
      (point) => point.marketValueUsd != null && point.costBasisUsd != null,
    ),
  );
  readonly classValuePoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.pricedClassPoints().map((point) => ({
        date: point.date,
        value: point.marketValueUsd!,
      })),
    ),
  );
  readonly classCostPoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.pricedClassPoints().map((point) => ({
        date: point.date,
        value: point.costBasisUsd!,
      })),
    ),
  );
  readonly classPnlPoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.pricedClassPoints().map((point) => ({
        date: point.date,
        value: (point.realizedPnlToDateUsd ?? 0) + (point.unrealizedPnlUsd ?? 0),
      })),
    ),
  );
  readonly classPnl = computed(() => this.classPnlPoints().at(-1)?.value ?? null);

  constructor() {
    effect(() => {
      const portfolioId = this.portfolioId();
      if (portfolioId) {
        this.selectedClass.set(null);
        void this.loadPortfolio(portfolioId);
        void this.loadHoldings(portfolioId);
      }
    });
    effect(() => {
      const portfolioId = this.portfolioId();
      const range = this.range();
      const selectedClass = this.selectedClass();
      if (portfolioId) {
        void this.loadSeries(portfolioId, range, selectedClass);
      }
    });
  }

  async loadPortfolio(portfolioId = this.portfolioId()) {
    this.state.set('loading');
    try {
      this.portfolio.set(await this.analyticsApi.getPortfolio(portfolioId));
      this.state.set('ready');
    } catch (error) {
      this.state.set(loadStateFor(error));
    }
  }

  async loadHoldings(portfolioId = this.portfolioId()) {
    this.holdingsState.set('loading');
    try {
      this.holdings.set(await this.analyticsApi.getPortfolioHoldings(portfolioId));
      this.holdingsState.set('ready');
    } catch (error) {
      this.holdingsState.set(loadStateFor(error));
    }
  }

  async loadSeries(
    portfolioId = this.portfolioId(),
    range = this.range(),
    selectedClass = this.selectedClass(),
  ) {
    const request = ++this.seriesRequest;
    this.seriesState.set('loading');
    try {
      if (selectedClass) {
        const series = await this.analyticsApi.getPortfolioClassSeries(
          portfolioId,
          selectedClass,
          rangeFor(range),
        );
        if (request === this.seriesRequest) {
          this.classSeries.set(series);
        }
      } else {
        const series = await this.analyticsApi.getPortfolioSeries(portfolioId, rangeFor(range));
        if (request === this.seriesRequest) {
          this.series.set(series);
        }
      }
      if (request === this.seriesRequest) {
        this.chartClass.set(selectedClass);
        this.chartsLoaded.set(true);
        this.seriesState.set('ready');
      }
    } catch (error) {
      if (request === this.seriesRequest) {
        this.seriesState.set(loadStateFor(error));
      }
    }
  }

  // Clicking the selected class again goes back to the whole portfolio.
  selectClass(instrumentClass: InstrumentClass | null) {
    this.selectedClass.set(this.selectedClass() === instrumentClass ? null : instrumentClass);
  }

  // A class slice selects the class; a holding slice opens the holding.
  onSliceClick(slice: PieChartSlice) {
    if (!this.selectedClass()) {
      const instrumentClass = classForLabel(slice.label);
      if (instrumentClass) {
        this.selectClass(instrumentClass);
      }
      return;
    }
    const holding = this.holdings().find(
      (row) => row.instrumentClass === this.selectedClass() && row.ticker === slice.label,
    );
    if (holding) {
      this.openHolding(holding);
    }
  }

  sortHoldings(column: HoldingColumn) {
    if (this.holdingSort() === column.key) {
      this.holdingDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.holdingSort.set(column.key);
      this.holdingDirection.set(column.numeric ? 'desc' : 'asc');
    }
  }

  holdingSortIndicator(column: HoldingColumn): string {
    return sortIndicator(this.holdingSort() === column.key, this.holdingDirection());
  }

  openHolding(holding: HoldingSnapshotResponse) {
    void this.router.navigate(['/analyst/holdings', holding.holdingId], {
      queryParams: { portfolioId: this.portfolioId() },
    });
  }
}
