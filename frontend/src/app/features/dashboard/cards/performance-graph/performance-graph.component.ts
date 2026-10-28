import { Component, computed, inject, signal } from '@angular/core';
import {
  WidgetCardComponent,
  WidgetStatus,
} from '@shared/components/widget-card/widget-card.component';
import {
  LineChartComponent,
  LineChartPoint,
  LineChartReferenceLine,
} from '@shared/components/line-chart/line-chart.component';
import { REPORTING_CURRENCY } from '@core/models/api.models';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { formatCurrency } from '@shared/utils/display-format';
import { Trend, trendForValue } from '@shared/utils/format-percentage-change';
import { formatSignedPct, formatSignedUsd } from '../portfolio-value/portfolio-returns.util';
import {
  PERFORMANCE_INTERVALS,
  PerformanceInterval,
  filterByInterval,
  summarize,
  toChartLabel,
} from './performance-graph.util';

@Component({
  selector: 'app-performance-graph-widget',
  standalone: true,
  imports: [WidgetCardComponent, LineChartComponent],
  templateUrl: './performance-graph.component.html',
  styleUrl: './performance-graph.component.css',
})
export class PerformanceGraphWidgetComponent {
  // The series is loaded once by the dashboard state and shared with the Portfolio Value total.
  private readonly state = inject(DASHBOARD_STATE_PORT);

  readonly formatCurrency = formatCurrency;
  readonly formatSignedUsd = formatSignedUsd;
  readonly formatSignedPct = formatSignedPct;
  readonly reportingCurrency = REPORTING_CURRENCY;
  readonly intervals = PERFORMANCE_INTERVALS;

  readonly status = computed<WidgetStatus>(() => this.state.performanceLoadState?.() ?? 'idle');
  readonly history = computed(() => this.state.performance?.() ?? []);
  readonly selectedInterval = signal<PerformanceInterval>('1M');
  readonly selectedIntervalIndex = computed(() =>
    this.intervals.indexOf(this.selectedInterval()),
  );

  readonly visiblePoints = computed(() =>
    filterByInterval(this.history(), this.selectedInterval()),
  );
  readonly chartPoints = computed<LineChartPoint[]>(() =>
    this.visiblePoints().map((point) => ({ label: toChartLabel(point.date), value: point.value })),
  );
  readonly summary = computed(() => summarize(this.visiblePoints()));
  readonly chartReferenceLines = computed<LineChartReferenceLine[]>(() => {
    const summary = this.summary();
    return summary
      ? [
          { label: 'High', value: summary.high },
          { label: 'Low', value: summary.low },
        ]
      : [];
  });
  // Grey when the change rounds to 0.00, as on the other cards.
  readonly trend = computed<Trend>(() => {
    const summary = this.summary();
    return summary ? trendForValue(summary.changePct ?? summary.change) : 'flat';
  });

  load() {
    void this.state.loadPerformance?.();
  }
}
