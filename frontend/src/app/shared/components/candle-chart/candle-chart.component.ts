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
import Chart from 'chart.js/auto';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import { InstrumentCandleResponse } from '@core/models/api.models';

Chart.register(CandlestickController, CandlestickElement);

export function toFinancialChartPoints(candles: InstrumentCandleResponse[]) {
  return candles.map((candle) => {
    const [year, month, day] = candle.date.split('-').map(Number);
    return {
      x: new Date(year, month - 1, day, 12).getTime(),
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close,
    };
  });
}

@Component({
  selector: 'app-candle-chart',
  standalone: true,
  templateUrl: './candle-chart.component.html',
  styleUrl: './candle-chart.component.css',
})
export class CandleChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  candles = input.required<InstrumentCandleResponse[]>();
  currency = input.required<string>();

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() {
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'candlestick',
      data: {
        datasets: [
          {
            label: 'Daily price',
            data: toFinancialChartPoints(this.candles()),
            backgroundColors: {
              up: '#25845d',
              down: '#d34f52',
              unchanged: '#818a86',
            },
            borderColors: {
              up: '#25845d',
              down: '#d34f52',
              unchanged: '#818a86',
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            type: 'timeseries',
            time: { unit: 'month' },
            ticks: { color: '#aeb2b0', maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: '#aeb2b0',
              callback: (value) => this.formatPrice(Number(value)),
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const timestamp = Number((items[0]?.raw as { x?: number } | undefined)?.x);
                return Number.isFinite(timestamp)
                  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp)
                  : '';
              },
              label: (context) => {
                const candle = context.raw as { o: number; h: number; l: number; c: number };
                return [
                  `Open: ${this.formatPrice(candle.o)}`,
                  `High: ${this.formatPrice(candle.h)}`,
                  `Low: ${this.formatPrice(candle.l)}`,
                  `Close: ${this.formatPrice(candle.c)}`,
                ];
              },
            },
          },
        },
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['candles'] || changes['currency']) && this.chart) {
      this.chart.data.datasets[0].data = toFinancialChartPoints(this.candles());
      this.chart.update();
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private formatPrice(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.currency(),
      maximumFractionDigits: 4,
    }).format(value);
  }
}