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
import { Chart, ChartData, ScriptableContext } from 'chart.js/auto';

export interface LineChartPoint {
  label: string;
  value: number;
}

// How y-axis ticks and tooltips show values. 'percent' expects fractions (0.05 = 5%).
export type LineChartValueFormat = 'currency' | 'percent' | 'number';

const COMPARE_COLOR = '#aeb2b0';
const COMPACT_X_TICKS = 6;
const COMPACT_Y_TICKS = 4;

// compact: short form for y-axis ticks ("$1.2K", "5%"); otherwise the full value for tooltips.
export function formatChartValue(
  value: number,
  format: LineChartValueFormat,
  compact: boolean,
  currency = 'USD',
): string {
  switch (format) {
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: compact ? 0 : 2,
      }).format(value);
    case 'number':
      return new Intl.NumberFormat('en-US', {
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 6,
      }).format(value);
    default:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
      }).format(value);
  }
}

function fadingFill(color: string) {
  return (context: ScriptableContext<'line'>) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) {
      return `${color}14`;
    }

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `${color}2e`);
    gradient.addColorStop(1, `${color}00`);
    return gradient;
  };
}

/**
 * Thin Chart.js line-chart wrapper. Owns chart creation/teardown so widgets
 * only need to pass in labelled data points.
 */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.css',
})
export class LineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  points = input.required<LineChartPoint[]>();
  positive = input<boolean>(true);
  // Grey line, wins over positive.
  flat = input<boolean>(false);
  // Small dashboard cards: fewer axis labels, fainter grid, fading fill. Read once when the chart is created.
  compact = input<boolean>(false);
  valueFormat = input<LineChartValueFormat>('currency');
  // Optional second line drawn dashed for comparison (e.g. cost basis under market value), on the same labels.
  comparePoints = input<LineChartPoint[] | null>(null);
  seriesLabel = input<string>('');
  compareLabel = input<string>('');
  currency = input<string>('USD');

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() {
    const compact = this.compact();

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: this.toChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            ticks: {
              color: '#aeb2b0',
              maxRotation: 0,
              autoSkip: true,
              ...(compact ? { maxTicksLimit: COMPACT_X_TICKS } : {}),
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: '#aeb2b0',
              callback: (value) => this.formatValue(Number(value), true),
              ...(compact ? { maxTicksLimit: COMPACT_Y_TICKS } : {}),
            },
            grid: { color: compact ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)' },
            border: { display: !compact },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const val = context.parsed?.y ?? context.parsed ?? context.raw;
                const prefix = context.dataset.label ? `${context.dataset.label}: ` : '';
                return `${prefix}${this.formatValue(Number(val), false)}`;
              },
            },
          },
        },
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      (changes['points'] || changes['positive'] || changes['flat'] || changes['comparePoints'] || changes['currency']) &&
      this.chart
    ) {
      this.chart.data = this.toChartData();
      this.chart.update();
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private formatValue(value: number, compact: boolean): string {
    return formatChartValue(value, this.valueFormat(), compact, this.currency());
  }

  private lineColor(): string {
    if (this.flat()) {
      return COMPARE_COLOR;
    }
    return this.positive() ? '#4fc46a' : '#e45b65';
  }

  private toChartData(): ChartData<'line'> {
    const points = this.points();
    const color = this.lineColor();
    const comparePoints = this.comparePoints();

    const datasets: ChartData<'line'>['datasets'] = [
      {
        label: this.seriesLabel(),
        data: points.map((point) => point.value),
        borderColor: color,
        backgroundColor: this.compact() ? fadingFill(color) : `${color}22`,
        pointRadius: (context) => (context.dataIndex === context.dataset.data.length - 1 ? 4 : 0),
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: !comparePoints,
        tension: 0.35,
      },
    ];

    if (comparePoints) {
      datasets.push({
        label: this.compareLabel(),
        data: comparePoints.map((point) => point.value),
        borderColor: COMPARE_COLOR,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5,
        fill: false,
        tension: 0.35,
      });
    }

    return {
      labels: points.map((point) => point.label),
      datasets,
    };
  }
}
