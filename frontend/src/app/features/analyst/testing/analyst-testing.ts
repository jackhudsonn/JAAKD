// Shared by the analyst specs: test data builders, and chart stand-ins (Chart.js needs a real canvas, which
// jsdom doesn't have).
import { Component, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  HoldingSnapshotResponse,
  InstrumentPerformanceResponse,
} from '@core/models/analytics.models';
import { AuditPageResponse } from '@core/services/audit-api.service';
import {
  LineChartPoint,
  LineChartValueFormat,
} from '@shared/components/line-chart/line-chart.component';
import { PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { SegmentBarDataset } from '../segment-bar-chart/segment-bar-chart.component';

export function page<T>(content: T[], totalPages = 1): AuditPageResponse<T> {
  return {
    content,
    page: 0,
    size: 25,
    totalElements: content.length,
    totalPages,
    hasNext: totalPages > 1,
  };
}

export function instrument(
  overrides: Partial<InstrumentPerformanceResponse> = {},
): InstrumentPerformanceResponse {
  return {
    instrumentId: 'instrument-1',
    ticker: 'AAPL',
    name: 'Apple Inc',
    market: 'NASDAQ',
    instrumentClass: 'EQUITY',
    tradingCurrency: 'USD',
    lastCloseUsd: 200,
    return1w: 0.01,
    return1m: 0.02,
    return3m: 0.03,
    returnYtd: 0.1,
    volatilityAnn: 0.2,
    maxDrawdown: -0.1,
    holderCount: 2,
    exposureUsd: 1000,
    netFlow30dUsd: 0,
    ...overrides,
  };
}

export function holding(overrides: Partial<HoldingSnapshotResponse> = {}): HoldingSnapshotResponse {
  return {
    holdingId: 'holding-1',
    instrumentId: 'instrument-1',
    ticker: 'AAPL',
    name: 'Apple Inc',
    instrumentClass: 'EQUITY',
    asOfDate: '2026-10-23',
    quantity: 5,
    costBasisUsd: 900,
    marketValueUsd: 1000,
    realizedPnlToDateUsd: 0,
    unrealizedPnlUsd: 100,
    ...overrides,
  };
}

export const unavailable = () => new HttpErrorResponse({ status: 503 });

// Waits for the components' promise chains (mocked API calls resolve on the microtask queue).
export const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

@Component({ selector: 'app-line-chart', standalone: true, template: '' })
export class LineChartStubComponent {
  points = input.required<LineChartPoint[]>();
  positive = input(true);
  valueFormat = input<LineChartValueFormat>('currency');
  comparePoints = input<LineChartPoint[] | null>(null);
  seriesLabel = input('');
  compareLabel = input('');
}

@Component({ selector: 'app-pie-chart', standalone: true, template: '' })
export class PieChartStubComponent {
  slices = input.required<PieChartSlice[]>();
  tooltipValuePrefix = input('');
  sliceClick = output<PieChartSlice>();
}

@Component({ selector: 'app-segment-bar-chart', standalone: true, template: '' })
export class SegmentBarChartStubComponent {
  labels = input.required<string[]>();
  datasets = input.required<SegmentBarDataset[]>();
  stacked = input(true);
  segmentClick = output<string>();
}
