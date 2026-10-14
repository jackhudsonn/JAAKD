import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { LineChartComponent } from '@shared/components/line-chart/line-chart.component';
import {
  DASHBOARD_MARKET_DATA_PORT,
  DashboardPerformanceInterval,
} from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';

@Component({
  selector: 'app-performance-graph-widget',
  standalone: true,
  imports: [WidgetCardComponent, LineChartComponent, DecimalPipe],
  templateUrl: './performance-graph.component.html',
  styleUrl: './performance-graph.component.css',
})
export class PerformanceGraphWidgetComponent {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);
  readonly backendDataMode = this.state.backendDataMode ?? false;

  intervals = this.marketData.performanceIntervals;
  selectedInterval = signal<DashboardPerformanceInterval>('1D');

  // TODO: replace getMockPerformanceSeries with a real call to
  // GET /portfolio/performance?interval={interval} and drop the mock helper.
  series = computed(() => this.marketData.getPerformanceSeries(this.selectedInterval()));

  startValue = computed(() => this.series()[0]?.value ?? 0);
  endValue = computed(() => this.series().at(-1)?.value ?? 0);
  highValue = computed(() => {
    const values = this.series().map((point) => point.value);

    return values.length > 0 ? Math.max(...values) : 0;
  });

  lowValue = computed(() => {
    const values = this.series().map((point) => point.value);

    return values.length > 0 ? Math.min(...values) : 0;
  });
  changeAmount = computed(() => this.endValue() - this.startValue());
  changePct = computed(() => {
    const start = this.startValue();
    return start === 0 ? 0 : (this.changeAmount() / start) * 100;
  });

  isPositive = computed(() => this.changeAmount() >= 0);

  selectInterval(interval: DashboardPerformanceInterval) {
    this.selectedInterval.set(interval);
  }
}
