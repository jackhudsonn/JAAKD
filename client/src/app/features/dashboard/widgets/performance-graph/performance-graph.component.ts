import { Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { LineChartComponent } from '../../../../shared/components/line-chart/line-chart.component';
import {
  PERFORMANCE_INTERVALS,
  PerformanceInterval,
  getMockPerformanceSeries,
} from '../../mock-data';

@Component({
  selector: 'app-performance-graph-widget',
  standalone: true,
  imports: [WidgetCardComponent, LineChartComponent, DecimalPipe],
  templateUrl: './performance-graph.component.html',
  styleUrl: './performance-graph.component.css',
})
export class PerformanceGraphWidgetComponent {
  intervals = PERFORMANCE_INTERVALS;
  selectedInterval = signal<PerformanceInterval>('1D');

  // TODO: replace getMockPerformanceSeries with a real call to
  // GET /portfolio/performance?interval={interval} and drop the mock helper.
  series = computed(() => getMockPerformanceSeries(this.selectedInterval()));

  startValue = computed(() => this.series()[0]?.value ?? 0);
  endValue = computed(() => this.series().at(-1)?.value ?? 0);

  changeAmount = computed(() => this.endValue() - this.startValue());
  changePct = computed(() => {
    const start = this.startValue();
    return start === 0 ? 0 : (this.changeAmount() / start) * 100;
  });

  isPositive = computed(() => this.changeAmount() >= 0);

  selectInterval(interval: PerformanceInterval) {
    this.selectedInterval.set(interval);
  }
}
