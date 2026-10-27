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

export interface SegmentBarDataset {
  label: string;
  color: string;
  // One share (0-1) per segment, in the same order as the labels.
  data: number[];
}

/**
 * Horizontal bars, one per segment (age band or country), as shares of 100%. Stacked, it shows each segment's
 * mix; with one dataset, how much of each segment's money is in one thing. Stays mounted while its data changes,
 * so bars animate to their new lengths.
 */
@Component({
  selector: 'app-segment-bar-chart',
  standalone: true,
  template: `<canvas #canvas></canvas>`,
  styles: [
    `
      :host {
        display: block;
      }

      canvas {
        width: 100% !important;
        height: 100% !important;
        cursor: pointer;
      }
    `,
  ],
  host: { '[style.height.px]': 'height()' },
})
export class SegmentBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  labels = input.required<string[]>();
  datasets = input.required<SegmentBarDataset[]>();
  stacked = input(true);
  // Emits the clicked segment's label.
  segmentClick = output<string>();

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  // Enough room per bar that labels never overlap.
  height() {
    return Math.max(240, this.labels().length * 44 + 70);
  }

  ngAfterViewInit() {
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'bar',
      data: this.toChartData(),
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          const index = elements[0]?.index;
          if (index !== undefined) {
            this.segmentClick.emit(this.labels()[index]);
          }
        },
        scales: {
          x: {
            stacked: this.stacked(),
            min: 0,
            max: this.stacked() ? 1 : undefined,
            ticks: {
              color: '#aeb2b0',
              callback: (value) => `${Math.round(Number(value) * 100)}%`,
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            stacked: this.stacked(),
            ticks: { color: '#d6d8d7' },
            grid: { display: false },
          },
        },
        plugins: {
          legend: {
            display: this.datasets().length > 1,
            position: 'bottom',
            labels: { color: '#d6d8d7', boxWidth: 12, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${(Number(context.raw ?? 0) * 100).toFixed(1)}%`,
            },
          },
        },
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.chart || !(changes['labels'] || changes['datasets'] || changes['stacked'])) {
      return;
    }
    // Both axes are linear/category scales, which do have these options; Chart.js types them as any scale.
    const x = this.chart.options.scales!['x'] as { stacked?: boolean; max?: number };
    const y = this.chart.options.scales!['y'] as { stacked?: boolean };
    x.stacked = this.stacked();
    y.stacked = this.stacked();
    x.max = this.stacked() ? 1 : undefined;
    this.chart.options.plugins!.legend!.display = this.datasets().length > 1;
    this.chart.data = this.toChartData();
    this.chart.update();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private toChartData(): ChartData<'bar'> {
    return {
      labels: this.labels(),
      datasets: this.datasets().map((dataset) => ({
        label: dataset.label,
        backgroundColor: dataset.color,
        borderRadius: 3,
        data: dataset.data,
      })),
    };
  }
}
