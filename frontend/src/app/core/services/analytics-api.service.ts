import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { InstrumentClass } from '@core/models/api.models';
import {
  AnalyticsMetaResponse,
  ClassSummaryResponse,
  ClassValuePoint,
  DateRange,
  HoldingSnapshotResponse,
  HoldingValuePoint,
  InstrumentListQuery,
  InstrumentPerformanceResponse,
  InstrumentPricePoint,
  PortfolioListQuery,
  PortfolioPerformanceResponse,
  PortfolioValuePoint,
  SegmentDimension,
  SegmentExposureResponse,
  SegmentFilter,
  SegmentFocus,
  SegmentSummaryResponse,
} from '@core/models/analytics.models';
import { AuditPageResponse } from '@core/services/audit-api.service';
import { environment } from '@environments/environment.local';
import { buildParams } from '@shared/utils/build-params';

// The analyst view's API (/api/analytics). Requires an ANALYST or ADMIN user; the backend answers 403 otherwise.
@Injectable({
  providedIn: 'root',
})
export class AnalyticsApiService {
  constructor(private readonly httpClient: HttpClient) {}

  getMeta(): Promise<AnalyticsMetaResponse> {
    return this.get('/meta');
  }

  getSummary(segment?: SegmentFilter): Promise<ClassSummaryResponse[]> {
    return this.get('/summary', buildParams(segment));
  }

  getCountries(): Promise<string[]> {
    return this.get('/countries');
  }

  getSegments(by: SegmentDimension): Promise<SegmentSummaryResponse[]> {
    return this.get('/segments', buildParams({ by }));
  }

  getSegmentExposure(
    by: SegmentDimension,
    focus?: SegmentFocus,
  ): Promise<SegmentExposureResponse[]> {
    return this.get('/segments/exposure', buildParams({ by, ...focus }));
  }

  listInstruments(
    query?: InstrumentListQuery,
  ): Promise<AuditPageResponse<InstrumentPerformanceResponse>> {
    return this.get('/instruments', buildParams(query));
  }

  getInstrument(instrumentId: string): Promise<InstrumentPerformanceResponse> {
    return this.get(`/instruments/${instrumentId}`);
  }

  getInstrumentSeries(instrumentId: string, range?: DateRange): Promise<InstrumentPricePoint[]> {
    return this.get(`/instruments/${instrumentId}/series`, buildParams(range));
  }

  listPortfolios(
    query?: PortfolioListQuery,
  ): Promise<AuditPageResponse<PortfolioPerformanceResponse>> {
    return this.get('/portfolios', buildParams(query));
  }

  getPortfolio(portfolioId: string): Promise<PortfolioPerformanceResponse> {
    return this.get(`/portfolios/${portfolioId}`);
  }

  getPortfolioSeries(portfolioId: string, range?: DateRange): Promise<PortfolioValuePoint[]> {
    return this.get(`/portfolios/${portfolioId}/series`, buildParams(range));
  }

  getPortfolioClassSeries(
    portfolioId: string,
    instrumentClass: InstrumentClass,
    range?: DateRange,
  ): Promise<ClassValuePoint[]> {
    return this.get(
      `/portfolios/${portfolioId}/class-series`,
      buildParams({ instrumentClass, ...range }),
    );
  }

  getPortfolioHoldings(portfolioId: string): Promise<HoldingSnapshotResponse[]> {
    return this.get(`/portfolios/${portfolioId}/holdings`);
  }

  getHoldingSeries(holdingId: string, range?: DateRange): Promise<HoldingValuePoint[]> {
    return this.get(`/holdings/${holdingId}/series`, buildParams(range));
  }

  private get<T>(path: string, params?: HttpParams): Promise<T> {
    return firstValueFrom(
      this.httpClient.get<T>(`${environment.apiUrl}/api/analytics${path}`, { params }),
    );
  }
}

// 503: the analytics database is down or hasn't been built yet. Pages show "temporarily unavailable" for this
// instead of a generic error.
export function isAnalyticsUnavailable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 503;
}
