import { InstrumentCandleResponse } from '@core/models/api.models';
import { toFinancialChartPoints } from './candle-chart.component';

describe('toFinancialChartPoints', () => {
  it('maps daily OHLC candles to financial chart points in UTC', () => {
    const candles: InstrumentCandleResponse[] = [
      {
        date: '2025-03-04',
        open: 100,
        high: 108,
        low: 98,
        close: 105,
        volume: 2400,
        currency: 'USD',
      },
    ];

    expect(toFinancialChartPoints(candles)).toEqual([
      { x: new Date(2025, 2, 4, 12).getTime(), o: 100, h: 108, l: 98, c: 105 },
    ]);
  });
});