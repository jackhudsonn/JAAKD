import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { InstrumentPerformanceResponse, InstrumentPricePoint } from '@core/models/analytics.models';
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
  formatPercent,
  formatUsd,
  rangeFor,
  rebaseCumulative,
  signClass,
} from '../analyst-format';
import { trendForFraction } from '@shared/utils/format-percentage-change';
import { LoadState, keepsContent, loadStateFor } from '../analyst-load-state';
import { LoadStateMessageComponent } from '../load-state-message/load-state-message.component';

@Component({
  selector: 'app-instrument-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    LineChartComponent,
    WidgetCardComponent,
    LoadStateMessageComponent,
  ],
  templateUrl: './instrument-detail.component.html',
  styleUrl: '../analyst.css',
})
export class InstrumentDetailComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly rangeOptions = RANGE_OPTIONS;
  readonly classLabels = CLASS_LABELS;
  readonly formatUsd = formatUsd;
  readonly formatPercent = formatPercent;
  readonly signClass = signClass;
  readonly trendForFraction = trendForFraction;
  readonly keepsContent = keepsContent;

  // A signal, not a one-off snapshot: Angular reuses this component when only the id in the URL changes.
  readonly instrumentId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('instrumentId') ?? '')),
    { initialValue: '' },
  );
  readonly range = signal<RangeKey>('1Y');

  readonly state = signal<LoadState>('loading');
  readonly instrument = signal<InstrumentPerformanceResponse | null>(null);
  readonly seriesState = signal<LoadState>('loading');
  readonly series = signal<InstrumentPricePoint[]>([]);
  private seriesRequest = 0;

  readonly pricePoints = computed<LineChartPoint[]>(() =>
    this.series().map((point) => ({ label: point.date, value: point.closeUsd })),
  );
  readonly returnPoints = computed(() =>
    rebaseCumulative(
      this.series().map((point) => ({ date: point.date, value: point.cumulativeReturn })),
    ),
  );
  readonly rangeReturn = computed(() => this.returnPoints().at(-1)?.value ?? null);
  // The latest price can be a few days older than the build: days without a real price are skipped.
  readonly lastPriceDate = computed(() => this.series().at(-1)?.date ?? null);

  constructor() {
    // Reload whenever the id in the URL or the selected range changes.
    effect(() => {
      const instrumentId = this.instrumentId();
      if (instrumentId) {
        void this.loadInstrument(instrumentId);
      }
    });
    effect(() => {
      const instrumentId = this.instrumentId();
      const range = this.range();
      if (instrumentId) {
        void this.loadSeries(instrumentId, range);
      }
    });
  }

  async loadInstrument(instrumentId = this.instrumentId()) {
    this.state.set('loading');
    try {
      this.instrument.set(await this.analyticsApi.getInstrument(instrumentId));
      this.state.set('ready');
    } catch (error) {
      this.state.set(loadStateFor(error));
    }
  }

  async loadSeries(instrumentId = this.instrumentId(), range = this.range()) {
    // Clicking 1M then 5Y quickly could otherwise let the slower 1M answer overwrite the 5Y chart.
    const request = ++this.seriesRequest;
    this.seriesState.set('loading');
    try {
      const series = await this.analyticsApi.getInstrumentSeries(instrumentId, rangeFor(range));
      if (request === this.seriesRequest) {
        this.series.set(series);
        this.seriesState.set('ready');
      }
    } catch (error) {
      if (request === this.seriesRequest) {
        this.seriesState.set(loadStateFor(error));
      }
    }
  }
}
