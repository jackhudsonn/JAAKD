import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LineChartComponent } from '@shared/components/line-chart/line-chart.component';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { PerformanceGraphWidgetComponent } from './performance-graph.component';

// Chart.js needs a real canvas, so the chart is swapped for a stub that only takes the inputs.
@Component({ selector: 'app-line-chart', standalone: true, template: '' })
class LineChartStubComponent {
  points = input<unknown>();
  positive = input<boolean>();
  flat = input<boolean>();
  compact = input<boolean>();
  seriesLabel = input<string>();
  referenceLines = input<unknown>();
}

const render = (state: 'loading' | 'idle' | 'error', points: { date: string; value: number }[]) => {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: DASHBOARD_STATE_PORT,
        useValue: { performance: signal(points), performanceLoadState: signal(state) },
      },
    ],
  });
  TestBed.overrideComponent(PerformanceGraphWidgetComponent, {
    remove: { imports: [LineChartComponent] },
    add: { imports: [LineChartStubComponent] },
  });
  const fixture = TestBed.createComponent(PerformanceGraphWidgetComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

describe('PerformanceGraphWidgetComponent', () => {
  it('renders the series with its current value and change', () => {
    const element = render('idle', [
      { date: '2026-10-19', value: 1000 },
      { date: '2026-10-20', value: 1050 },
    ]);
    expect(element.textContent).toContain('$1,050.00');
    expect(element.textContent).toContain('+$50.00');
  });

  it('places the time range controls below the chart without a text summary', () => {
    const element = render('idle', [
      { date: '2026-10-19', value: 1000 },
      { date: '2026-10-20', value: 1050 },
    ]);
    const body = element.querySelector('.performance-body');

    expect(body?.firstElementChild?.tagName).toBe('APP-LINE-CHART');
    expect(body?.lastElementChild?.classList.contains('interval-tabs')).toBe(true);
    expect(element.querySelector('.performance-summary')).toBeNull();
  });

  it('shows the loading skeleton', () => {
    expect(render('loading', []).querySelector('.widget-card-skeleton')).not.toBeNull();
  });

  it('shows the error state', () => {
    expect(render('error', []).textContent).toContain('currently unavailable');
  });
});
