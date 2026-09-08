import {
  AfterViewInit,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  input,
  output,
} from '@angular/core';
import { Chart, ChartData } from 'chart.js/auto';

export interface PieChartSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Thin Chart.js wrapper shared by both allocation widgets.
 * Owns chart creation/teardown so the widgets only need to pass slice data.
 */
@Component({
  selector: 'app-pie-chart',
  standalone: true,
  template: `<canvas #canvas></canvas>`,
  styles: [
    `
      :host {
        display: block;
        height: 220px;
        margin-top: var(--space-md);
      }

      canvas {
        width: 100% !important;
        height: 100% !important;
        cursor: pointer;
      }
    `,
  ],
})
export class PieChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  slices = input.required<PieChartSlice[]>();

  // Emits the clicked slice (if any) so parent widgets can drill down.
  sliceClick = output<PieChartSlice>();

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() {
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'doughnut',
      data: this.toChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => this.handleClick(elements),
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#d6d8d7', boxWidth: 12, padding: 12 },
          },
        },
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['slices'] && this.chart) {
      this.chart.data = this.toChartData();
      this.chart.update();
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private handleClick(elements: { index: number }[]) {
    const element = elements[0];
    if (!element) {
      return;
    }

    const slice = this.slices()[element.index];
    if (slice) {
      this.sliceClick.emit(slice);
    }
  }

  private toChartData(): ChartData<'doughnut'> {
    const slices = this.slices();
    return {
      labels: slices.map((slice) => slice.label),
      datasets: [
        {
          data: slices.map((slice) => slice.value),
          backgroundColor: slices.map((slice) => slice.color),
          borderColor: '#414141',
          borderWidth: 2,
        },
      ],
    };
  }
}
