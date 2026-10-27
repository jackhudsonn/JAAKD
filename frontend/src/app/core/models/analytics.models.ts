// Mirrors the backend's dto/analytics records served under /api/analytics.
// Money is in USD. Returns, volatility and drawdown are fractions (0.05 = 5%) and are null when there isn't
// enough price history for the window. Dates are ISO strings: 'YYYY-MM-DD', timestamps with an offset.
import { InstrumentClass } from './api.models';

// Values the API accepts; anything else is rejected with a 400.
export const AGE_BANDS = ['<25', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type InstrumentSort =
  | 'ticker'
  | 'name'
  | 'instrumentClass'
  | 'lastClose'
  | 'return1w'
  | 'return1m'
  | 'return3m'
  | 'returnYtd'
  | 'volatility'
  | 'maxDrawdown'
  | 'holders'
  | 'exposure'
  | 'netFlow30d';

export type PortfolioSort =
  | 'country'
  | 'ageBand'
  | 'marketValue'
  | 'return1w'
  | 'return1m'
  | 'return3m'
  | 'returnYtd'
  | 'volatility'
  | 'maxDrawdown'
  | 'realizedPnl'
  | 'unrealizedPnl';

export type SortDirection = 'asc' | 'desc';

// Series endpoints default to the last year and allow at most 5 years.
export const MAX_SERIES_YEARS = 5;

export interface AnalyticsPaging {
  page?: number;
  size?: number;
}

// A group of retail portfolios by their owners' country and/or age band. A missing country is 'Unknown'.
export interface SegmentFilter {
  country?: string;
  ageBand?: AgeBand;
}

export type SegmentDimension = 'ageBand' | 'country';

export interface InstrumentListQuery extends AnalyticsPaging, SegmentFilter {
  instrumentClass?: InstrumentClass;
  // Matches anywhere in the ticker or name, ignoring case.
  search?: string;
  sort?: InstrumentSort;
  direction?: SortDirection;
}

export interface PortfolioListQuery extends AnalyticsPaging, SegmentFilter {
  sort?: PortfolioSort;
  direction?: SortDirection;
}

export interface DateRange {
  from?: string;
  to?: string;
}

// Both null until the first analytics build has run.
export interface AnalyticsMetaResponse {
  sourceSnapshotAt: string | null;
  builtAt: string | null;
}

export interface ClassSummaryResponse {
  instrumentClass: InstrumentClass;
  instrumentCount: number;
  // Open portfolio positions: a portfolio holding two equities counts twice.
  positionCount: number;
  exposureUsd: number | null;
  averageReturn1m: number | null;
}

export interface InstrumentPerformanceResponse {
  instrumentId: string;
  ticker: string;
  name: string;
  market: string;
  instrumentClass: InstrumentClass;
  tradingCurrency: string;
  lastCloseUsd: number | null;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  returnYtd: number | null;
  volatilityAnn: number | null;
  maxDrawdown: number | null;
  holderCount: number;
  exposureUsd: number | null;
  netFlow30dUsd: number | null;
}

export interface InstrumentPricePoint {
  date: string;
  // In the instrument's trading currency.
  close: number;
  closeUsd: number;
  dailyReturn: number | null;
  cumulativeReturn: number | null;
}

// Retail portfolios only. Pseudonymous: no names, emails, birth dates or portfolio names.
export interface PortfolioPerformanceResponse {
  portfolioId: string;
  userId: string;
  // 'Unknown' when the owner has no country.
  country: string;
  ageBand: AgeBand;
  marketValueUsd: number | null;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  returnYtd: number | null;
  volatilityAnn: number | null;
  maxDrawdown: number | null;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
}

// cumulativeTwr is the time-weighted return since the portfolio's first day, so deposits and withdrawals
// don't count as performance.
export interface PortfolioValuePoint {
  date: string;
  marketValueUsd: number;
  cashUsd: number;
  netExternalFlowUsd: number;
  dailyReturn: number | null;
  cumulativeTwr: number | null;
}

export interface HoldingSnapshotResponse {
  holdingId: string;
  instrumentId: string;
  ticker: string;
  name: string;
  instrumentClass: InstrumentClass;
  asOfDate: string;
  quantity: number;
  costBasisUsd: number | null;
  marketValueUsd: number | null;
  realizedPnlToDateUsd: number | null;
  unrealizedPnlUsd: number | null;
}

// A portfolio's holdings in one instrument class, added up per day. No quantity (shares of different
// instruments don't add up) and no time-weighted return.
export interface ClassValuePoint {
  date: string;
  costBasisUsd: number | null;
  marketValueUsd: number | null;
  realizedPnlToDateUsd: number | null;
  unrealizedPnlUsd: number | null;
}

export interface SegmentClassExposure {
  instrumentClass: InstrumentClass;
  exposureUsd: number;
  holderCount: number;
}

// One age band or country. classes: how its investments split across classes (cash excluded), largest first.
export interface SegmentSummaryResponse {
  segment: string;
  portfolioCount: number;
  marketValueUsd: number;
  averageReturnYtd: number | null;
  classes: SegmentClassExposure[];
}

// One age band or country's exposure to a chosen class or instrument, next to everything it has invested
// (cash excluded): exposureUsd / segmentTotalUsd compares segments of different sizes.
export interface SegmentExposureResponse {
  segment: string;
  exposureUsd: number;
  holderCount: number;
  segmentTotalUsd: number;
}

// What a segment exposure query is about: one class, one instrument, or (neither) all investments.
export interface SegmentFocus {
  instrumentClass?: InstrumentClass;
  instrumentId?: string;
}

export interface HoldingValuePoint {
  date: string;
  quantity: number;
  costBasisUsd: number | null;
  marketValueUsd: number | null;
  realizedPnlToDateUsd: number | null;
  unrealizedPnlUsd: number | null;
}
