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

export interface AuditOrderLogSearchRequest extends AuditPaging {
  userId?: string;
  date?: string;
  status?: OrderStatus;
  ticker?: string;
  instrumentId?: string;
  instrumentType?: InstrumentClass;
}

@Injectable({
  providedIn: 'root',
})
export class AuditApiService {
  constructor(private readonly httpClient: HttpClient) {}

  searchUsers(query: string, paging?: AuditPaging): Promise<AuditUserSearchResponse[]> {
    let params = new HttpParams().set('query', query.trim());

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<AuditUserSearchResponse[]>(`${environment.apiUrl}/api/audit/users`, {
        params,
      }),
    );
  }

  searchOrderLogs(request: AuditOrderLogSearchRequest): Promise<OrderLogResponse[]> {
    let params = new HttpParams();

    if (request.date?.trim()) {
      params = params.set('date', request.date.trim());
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

    if (request.page !== undefined) {
      params = params.set('page', request.page);
    }

    if (request.size !== undefined) {
      params = params.set('size', request.size);
    }

    return firstValueFrom(
      this.httpClient.get<OrderLogResponse[]>(`${environment.apiUrl}/api/audit/order-logs`, { params }),
    );
  }

  listUserPortfolios(userId: string, paging?: AuditPaging): Promise<PortfolioResponse[]> {
    let params = new HttpParams();

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<PortfolioResponse[]>(`${environment.apiUrl}/api/audit/users/${userId}/portfolios`, {
        params,
      }),
    );
  }

  listUserHoldings(
    userId: string,
    options?: AuditPaging & { portfolioId?: string },
  ): Promise<HoldingResponse[]> {
    let params = new HttpParams();

    if (options?.portfolioId) {
      params = params.set('portfolioId', options.portfolioId);
    }

    if (options?.page !== undefined) {
      params = params.set('page', options.page);
    }

    if (options?.size !== undefined) {
      params = params.set('size', options.size);
    }

    return firstValueFrom(
      this.httpClient.get<HoldingResponse[]>(`${environment.apiUrl}/api/audit/users/${userId}/holdings`, {
        params,
      }),
    );
  }

  listHoldingPositionLots(holdingId: string, paging?: AuditPaging): Promise<PositionLotResponse[]> {
    let params = new HttpParams();

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<PositionLotResponse[]>(
        `${environment.apiUrl}/api/audit/holdings/${holdingId}/position-lots`,
        { params },
      ),
    );
  }

  listHoldingLotMatches(holdingId: string, paging?: AuditPaging): Promise<LotMatchResponse[]> {
    let params = new HttpParams();

    if (paging?.page !== undefined) {
      params = params.set('page', paging.page);
    }

    if (paging?.size !== undefined) {
      params = params.set('size', paging.size);
    }

    return firstValueFrom(
      this.httpClient.get<LotMatchResponse[]>(
        `${environment.apiUrl}/api/audit/holdings/${holdingId}/lot-matches`,
        {
          params,
        },
      ),
    );
  }
}
