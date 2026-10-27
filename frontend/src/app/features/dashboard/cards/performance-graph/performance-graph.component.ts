import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  WidgetCardComponent,
  WidgetStatus,
} from '@shared/components/widget-card/widget-card.component';
import {
  LineChartComponent,
  LineChartPoint,
} from '@shared/components/line-chart/line-chart.component';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { PortfolioPerformancePoint, REPORTING_CURRENCY } from '@core/models/api.models';
import { formatCurrency } from '@shared/utils/display-format';
import { isFlatChange } from '@shared/utils/format-percentage-change';
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
export class PerformanceGraphWidgetComponent implements OnInit {
  private readonly portfolioApiService = inject(PortfolioApiService);

  readonly formatCurrency = formatCurrency;
  readonly formatSignedUsd = formatSignedUsd;
  readonly formatSignedPct = formatSignedPct;
  readonly reportingCurrency = REPORTING_CURRENCY;
  readonly intervals = PERFORMANCE_INTERVALS;

  readonly status = signal<WidgetStatus>('loading');
  readonly history = signal<PortfolioPerformancePoint[]>([]);
  readonly selectedInterval = signal<PerformanceInterval>('1M');

  readonly visiblePoints = computed(() =>
    filterByInterval(this.history(), this.selectedInterval()),
  );
  readonly chartPoints = computed<LineChartPoint[]>(() =>
    this.visiblePoints().map((point) => ({ label: toChartLabel(point.date), value: point.value })),
  );
  readonly summary = computed(() => summarize(this.visiblePoints()));
  // Grey when the change rounds to 0.00, as on the other cards.
  readonly trend = computed<'up' | 'down' | 'flat'>(() => {
    const summary = this.summary();
    if (!summary || isFlatChange(summary.changePct ?? summary.change)) {
      return 'flat';
    }

    return summary.change > 0 ? 'up' : 'down';
  });

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.status.set('loading');
    try {
      const portfolio = await this.portfolioApiService.ensureDefault();
      this.history.set(await this.portfolioApiService.getPerformance(portfolio.portfolioId));
      this.status.set('idle');
    } catch (error) {
      console.error('Failed to load portfolio performance', error);
      this.status.set('error');
    }
  }
}
