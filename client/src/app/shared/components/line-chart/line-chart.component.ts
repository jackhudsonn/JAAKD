import {
  AfterViewInit,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  input,
} from '@angular/core';
import { Chart, ChartData } from 'chart.js/auto';

export interface LineChartPoint {
  label: string;
  value: number;
}

/**
 * Thin Chart.js line-chart wrapper. Owns chart creation/teardown so widgets
 * only need to pass in labelled data points.
 */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  template: `<canvas #canvas></canvas>`,
  styles: [
    `
      :host {
        display: block;
        height: 220px;
      }

      canvas {
        width: 100% !important;
        height: 100% !important;
      }
    `,
  ],
})
export class LineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  points = input.required<LineChartPoint[]>();
  positive = input<boolean>(true);

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() {
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: this.toChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            ticks: { color: '#aeb2b0', maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
          y: {
            ticks: { color: '#aeb2b0' },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['points'] || changes['positive']) && this.chart) {
      this.chart.data = this.toChartData();
      this.chart.update();
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private toChartData(): ChartData<'line'> {
    const points = this.points();
    const color = this.positive() ? '#4fc46a' : '#e45b65';

    return {
      labels: points.map((point) => point.label),
      datasets: [
        {
          data: points.map((point) => point.value),
          borderColor: color,
          backgroundColor: `${color}22`,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }
}
