import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioApiService } from '@core/services/portfolio-api.service';
import { LineChartComponent } from '@shared/components/line-chart/line-chart.component';
import { PortfolioPerformancePoint } from '@core/models/api.models';
import { PerformanceGraphWidgetComponent } from './performance-graph.component';

// Chart.js needs a real canvas, so the chart is swapped for a stub that only takes the inputs.
@Component({ selector: 'app-line-chart', standalone: true, template: '' })
class LineChartStubComponent {
  points = input<unknown>();
  positive = input<boolean>();
  flat = input<boolean>();
  compact = input<boolean>();
  seriesLabel = input<string>();
}

const setup = async (getPerformance: () => Promise<PortfolioPerformancePoint[]>, settle = true) => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  TestBed.resetTestingModule();
  const api = {
    ensureDefault: vi.fn(async () => ({ portfolioId: 'p1' })),
    getPerformance: vi.fn(getPerformance),
  };
  TestBed.configureTestingModule({ providers: [{ provide: PortfolioApiService, useValue: api }] });
  TestBed.overrideComponent(PerformanceGraphWidgetComponent, {
    remove: { imports: [LineChartComponent] },
    add: { imports: [LineChartStubComponent] },
  });

  const fixture = TestBed.createComponent(PerformanceGraphWidgetComponent);
  fixture.detectChanges();
  if (settle) {
    await vi.waitFor(() => expect(fixture.componentInstance.status()).not.toBe('loading'));
    fixture.detectChanges();
  }

  const element = fixture.nativeElement as HTMLElement;
  const text = () => element.textContent?.replace(/\s+/g, ' ');
  return { fixture, element, text, api };
};

describe('PerformanceGraphWidgetComponent', () => {
  it('shows value, change and range per interval from one fetch', async () => {
    const { fixture, element, text, api } = await setup(async () => [
      { date: '2026-01-05', value: 500 },
      { date: '2026-10-18', value: 1000 },
      { date: '2026-10-19', value: 1100 },
      { date: '2026-10-20', value: 1050 },
    ]);
    expect(text()).toContain('$1,050.00 +$50.00 (+5.00%)');
    expect(text()).toContain('High $1,100.00 · Low $1,000.00 · Change +5.00%');

    element.querySelectorAll<HTMLButtonElement>('.interval-tab')[2].click(); // YTD
    fixture.detectChanges();
    expect(text()).toContain('High $1,100.00 · Low $500.00 · Change +110.00%');
    expect(api.getPerformance).toHaveBeenCalledTimes(1);
  });

  it('colours the change up, down, or grey when flat', async () => {
    const trendOf = async (end: number) => {
      const { element } = await setup(async () => [
        { date: '2026-10-19', value: 100 },
        { date: '2026-10-20', value: end },
      ]);
      return element
        .querySelector('.performance-summary .change')
        ?.className.replace('change', '')
        .trim();
    };
    expect([await trendOf(110), await trendOf(90), await trendOf(100.001)]).toEqual([
      'up',
      'down',
      'flat',
    ]);
  });

  it('shows the skeleton, then the empty or error state', async () => {
    expect(
      (await setup(() => new Promise(() => undefined), false)).element.querySelector(
        '.widget-card-skeleton',
      ),
    ).not.toBeNull();
    expect((await setup(async () => [])).text()).toContain('No history yet.');
    expect((await setup(() => Promise.reject(new Error('boom')))).text()).toContain(
      'currently unavailable',
    );
  });
});
