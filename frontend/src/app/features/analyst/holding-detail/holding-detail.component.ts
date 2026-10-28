import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { HoldingSnapshotResponse, HoldingValuePoint } from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import {
  LineChartComponent,
  LineChartPoint,
} from '@shared/components/line-chart/line-chart.component';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import {
  CLASS_LABELS,
  RANGE_OPTIONS,
  RangeKey,
  formatQuantity,
  formatUsd,
  rangeFor,
  shortId,
  signClass,
} from '../analyst-format';
import { toDateChartPoints } from '@shared/utils/chart-date-label';
import { trendForValue } from '@shared/utils/format-percentage-change';
import { LoadState, keepsContent, loadStateFor } from '../analyst-load-state';
import { LoadStateMessageComponent } from '../load-state-message/load-state-message.component';

@Component({
  selector: 'app-holding-detail',
  standalone: true,
  imports: [RouterLink, LineChartComponent, WidgetCardComponent, LoadStateMessageComponent],
  templateUrl: './holding-detail.component.html',
  styleUrl: '../analyst.css',
})
export class HoldingDetailComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly rangeOptions = RANGE_OPTIONS;
  readonly classLabels = CLASS_LABELS;
  readonly formatUsd = formatUsd;
  readonly formatQuantity = formatQuantity;
  readonly signClass = signClass;
  readonly trendForValue = trendForValue;
  readonly shortId = shortId;
  readonly keepsContent = keepsContent;

  readonly holdingId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('holdingId') ?? '')),
    { initialValue: '' },
  );
  // Set when arriving from a portfolio page; used for the back link and the ticker in the heading.
  readonly portfolioId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('portfolioId'))),
    { initialValue: null },
  );
  readonly range = signal<RangeKey>('1Y');

  readonly state = signal<LoadState>('loading');
  readonly series = signal<HoldingValuePoint[]>([]);
  readonly holding = signal<HoldingSnapshotResponse | null>(null);
  private seriesRequest = 0;

  // Days without a price have no market value; both lines skip them so they stay on the same dates.
  private readonly pricedPoints = computed(() =>
    this.series().filter((point) => point.marketValueUsd != null && point.costBasisUsd != null),
  );
  readonly valuePoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.pricedPoints().map((point) => ({ date: point.date, value: point.marketValueUsd! })),
    ),
  );
  readonly costPoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.pricedPoints().map((point) => ({ date: point.date, value: point.costBasisUsd! })),
    ),
  );
  readonly pnlPoints = computed<LineChartPoint[]>(() =>
    toDateChartPoints(
      this.pricedPoints().map((point) => ({
        date: point.date,
        value: (point.realizedPnlToDateUsd ?? 0) + (point.unrealizedPnlUsd ?? 0),
      })),
    ),
  );
  readonly latest = computed(() => this.series().at(-1) ?? null);
  readonly totalPnl = computed(() => this.pnlPoints().at(-1)?.value ?? null);

  constructor() {
    effect(() => {
      const holdingId = this.holdingId();
      const range = this.range();
      if (holdingId) {
        void this.loadSeries(holdingId, range);
      }
    });
    effect(() => {
      const holdingId = this.holdingId();
      const portfolioId = this.portfolioId();
      if (holdingId && portfolioId) {
        void this.loadHolding(holdingId, portfolioId);
      }
    });
  }

  async loadSeries(holdingId = this.holdingId(), range = this.range()) {
    const request = ++this.seriesRequest;
    this.state.set('loading');
    try {
      const series = await this.analyticsApi.getHoldingSeries(holdingId, rangeFor(range));
      if (request === this.seriesRequest) {
        this.series.set(series);
        this.state.set('ready');
      }
    } catch (error) {
      if (request === this.seriesRequest) {
        this.state.set(loadStateFor(error));
      }
    }
  }

  // The series has no ticker or name, so look the holding up in its portfolio's current holdings.
  // Only for the heading: if this fails the page still works, showing the holding id instead.
  private async loadHolding(holdingId: string, portfolioId: string) {
    try {
      const holdings = await this.analyticsApi.getPortfolioHoldings(portfolioId);
      this.holding.set(holdings.find((holding) => holding.holdingId === holdingId) ?? null);
    } catch {
      this.holding.set(null);
    }
  }
}
