import { TestBed } from '@angular/core/testing';
import { LineChartComponent, formatChartValue } from './line-chart.component';

describe('LineChartComponent', () => {
  it('formats values as US dollars by default, so the dashboard charts are unchanged', () => {
    const component = TestBed.runInInjectionContext(() => new LineChartComponent());

    expect(component.valueFormat()).toBe('currency');
  });

  describe('formatChartValue', () => {
    it('shows percent fractions as percentages', () => {
      expect(formatChartValue(0.0512, 'percent', false)).toBe('5.12%');
      expect(formatChartValue(-0.25, 'percent', false)).toBe('-25%');
    });

    it('rounds percent axis ticks to whole numbers', () => {
      expect(formatChartValue(0.0512, 'percent', true)).toBe('5%');
    });

    it('shows currency in full for tooltips and compact for axis ticks', () => {
      expect(formatChartValue(1234.5, 'currency', false)).toBe('$1,234.50');
      expect(formatChartValue(1234.5, 'currency', true)).toBe('$1.2K');
      expect(formatChartValue(1234.5, 'currency', false, 'EUR')).toBe('€1,234.50');
    });

    it('shows plain numbers with up to 6 decimals, compact on the axis', () => {
      expect(formatChartValue(0.1234567, 'number', false)).toBe('0.123457');
      expect(formatChartValue(25000, 'number', true)).toBe('25K');
    });
  });
});
