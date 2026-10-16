import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  HoldingResponse,
  InstrumentClass,
  OrderLogResponse,
  OrderStatus,
  PortfolioResponse,
} from '@core/models/api.models';
import { environment } from '@environments/environment.local';

export interface AuditUserSearchResponse {
  userId: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface AuditOwnerFields {
  ownerUserId: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

export interface AuditOrderLogResponse extends OrderLogResponse, AuditOwnerFields {}

export interface AuditHoldingResponse extends HoldingResponse, AuditOwnerFields {}

export interface PositionLotResponse {
  positionLotId?: string;
  positionLotID?: string;
  holdingId?: string;
  holdingID?: string;
  sourceBuyLogOrderId?: string;
  sourceBuyLogOrderID?: string;
  originalQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  openedAt: string;
}

export interface LotMatchResponse {
  lotMatchId?: string;
  lotMatchID?: string;
  positionLotId?: string;
  positionLotID?: string;
  sellLogOrderId?: string;
  sellLogOrderID?: string;
  matchedQuantity: number;
  sellUnitPrice?: number;
  proceedsPerUnit?: number;
  realizedPnlAmount?: number;
  realizedPnl?: number;
  matchedAt: string;
}

export interface AuditPaging {
  page?: number;
  size?: number;
}

export interface AuditPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface AuditOrderLogSearchRequest extends AuditPaging {
  userId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  status?: OrderStatus;
  ticker?: string;
  instrumentId?: string;
  instrumentType?: InstrumentClass;
  orderId?: string;
  latestOnly?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuditApiService {
  constructor(private readonly httpClient: HttpClient) {}

  searchUsers(query?: string, paging?: AuditPaging): Promise<AuditPageResponse<AuditUserSearchResponse>> {
    let params = new HttpParams();

    if (query?.trim()) {
      params = params.set('query', query.trim());
    }

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<AuditUserSearchResponse>>(`${environment.apiUrl}/api/audit/users`, {
        params,
      }),
    );
  }

  searchOrderLogs(request: AuditOrderLogSearchRequest): Promise<AuditPageResponse<AuditOrderLogResponse>> {
    let params = new HttpParams();

    if (request.date?.trim()) {
      params = params.set('date', request.date.trim());
    }

    if (request.fromDate?.trim()) {
      params = params.set('fromDate', request.fromDate.trim());
    }

    if (request.toDate?.trim()) {
      params = params.set('toDate', request.toDate.trim());
    }

    if (request.userId) {
      params = params.set('userId', request.userId);
    }

    if (request.status) {
      params = params.set('status', request.status);
    }

    if (request.ticker?.trim()) {
      params = params.set('ticker', request.ticker.trim());
    }

    if (request.instrumentId?.trim()) {
      params = params.set('instrumentId', request.instrumentId.trim());
    }

    if (request.instrumentType) {
      params = params.set('instrumentType', request.instrumentType);
    }

    if (request.orderId) {
      params = params.set('orderId', request.orderId);
    }

    if (request.latestOnly) {
      params = params.set('latestOnly', true);
    }

    if (request.page !== undefined) {
      params = params.set('page', request.page);
    }

    if (request.size !== undefined) {
      params = params.set('size', request.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<AuditOrderLogResponse>>(`${environment.apiUrl}/api/audit/order-logs`, { params }),
    );
  }

  listUserPortfolios(userId: string, paging?: AuditPaging): Promise<AuditPageResponse<PortfolioResponse>> {
    let params = new HttpParams();

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<PortfolioResponse>>(`${environment.apiUrl}/api/audit/users/${userId}/portfolios`, {
        params,
      }),
    );
  }

  listHoldings(options?:
    AuditPaging &
    { userId?: string; portfolioId?: string; instrumentId?: string }
  ): Promise<AuditPageResponse<AuditHoldingResponse>> {
    let params = new HttpParams();

    if (options?.userId?.trim()) {
      params = params.set('userId', options.userId.trim());
    }

    if (options?.portfolioId?.trim()) {
      params = params.set('portfolioId', options.portfolioId.trim());
    }

    if (options?.instrumentId?.trim()) {
      params = params.set('instrumentId', options.instrumentId.trim());
    }

    if (options?.page !== undefined) {
      params = params.set('page', options.page);
    }

    if (options?.size !== undefined) {
      params = params.set('size', options.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<AuditHoldingResponse>>(`${environment.apiUrl}/api/audit/holdings`, {
        params,
      }),
    );
  }

  listUserHoldings(
    userId: string,
    options?: AuditPaging & { portfolioId?: string; instrumentId?: string },
  ): Promise<AuditPageResponse<AuditHoldingResponse>> {
    let params = new HttpParams();

    if (options?.portfolioId) {
      params = params.set('portfolioId', options.portfolioId);
    }

    if (options?.instrumentId) {
      params = params.set('instrumentId', options.instrumentId);
    }

    if (options?.page !== undefined) {
      params = params.set('page', options.page);
    }

    if (options?.size !== undefined) {
      params = params.set('size', options.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<AuditHoldingResponse>>(`${environment.apiUrl}/api/audit/users/${userId}/holdings`, {
        params,
      }),
    );
  }

  listHoldingOrderLogs(
    holdingId: string,
    options?: AuditPaging & { fromDate?: string; toDate?: string; status?: OrderStatus },
  ): Promise<AuditPageResponse<AuditOrderLogResponse>> {
    let params = new HttpParams();

    if (options?.fromDate?.trim()) {
      params = params.set('fromDate', options.fromDate.trim());
    }

    if (options?.toDate?.trim()) {
      params = params.set('toDate', options.toDate.trim());
    }

    if (options?.status) {
      params = params.set('status', options.status);
    }

    if (options?.page !== undefined) {
      params = params.set('page', options.page);
    }

    if (options?.size !== undefined) {
      params = params.set('size', options.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<AuditOrderLogResponse>>(
        `${environment.apiUrl}/api/audit/holdings/${holdingId}/order-logs`,
        { params },
      ),
    );
  }

  listHoldingPositionLots(holdingId: string, paging?: AuditPaging): Promise<AuditPageResponse<PositionLotResponse>> {
    let params = new HttpParams();

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<PositionLotResponse>>(
        `${environment.apiUrl}/api/audit/holdings/${holdingId}/position-lots`,
        { params },
      ),
    );
  }

  listHoldingLotMatches(holdingId: string, paging?: AuditPaging): Promise<AuditPageResponse<LotMatchResponse>> {
    let params = new HttpParams();

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditPageResponse<LotMatchResponse>>(
        `${environment.apiUrl}/api/audit/holdings/${holdingId}/lot-matches`,
        {
          params,
        },
      ),
    );
  }
}
