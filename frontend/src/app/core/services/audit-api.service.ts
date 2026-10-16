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
    return this.getPage('/api/audit/users', buildParams({ query, ...paging }));
  }

  searchOrderLogs(request: AuditOrderLogSearchRequest): Promise<AuditPageResponse<AuditOrderLogResponse>> {
    return this.getPage('/api/audit/order-logs', buildParams(request));
  }

  listUserPortfolios(userId: string, paging?: AuditPaging): Promise<AuditPageResponse<PortfolioResponse>> {
    return this.getPage(`/api/audit/users/${userId}/portfolios`, buildParams(paging));
  }

  listHoldings(
    options?: AuditPaging & { userId?: string; portfolioId?: string; instrumentId?: string },
  ): Promise<AuditPageResponse<AuditHoldingResponse>> {
    return this.getPage('/api/audit/holdings', buildParams(options));
  }

  listUserHoldings(
    userId: string,
    options?: AuditPaging & { portfolioId?: string; instrumentId?: string },
  ): Promise<AuditPageResponse<AuditHoldingResponse>> {
    return this.getPage(`/api/audit/users/${userId}/holdings`, buildParams(options));
  }

  listHoldingOrderLogs(
    holdingId: string,
    options?: AuditPaging & { fromDate?: string; toDate?: string; status?: OrderStatus },
  ): Promise<AuditPageResponse<AuditOrderLogResponse>> {
    return this.getPage(`/api/audit/holdings/${holdingId}/order-logs`, buildParams(options));
  }

  listHoldingPositionLots(holdingId: string, paging?: AuditPaging): Promise<AuditPageResponse<PositionLotResponse>> {
    return this.getPage(`/api/audit/holdings/${holdingId}/position-lots`, buildParams(paging));
  }

  listHoldingLotMatches(holdingId: string, paging?: AuditPaging): Promise<AuditPageResponse<LotMatchResponse>> {
    return this.getPage(`/api/audit/holdings/${holdingId}/lot-matches`, buildParams(paging));
  }

  private getPage<T>(path: string, params: HttpParams): Promise<AuditPageResponse<T>> {
    return firstValueFrom(this.httpClient.get<AuditPageResponse<T>>(`${environment.apiUrl}${path}`, { params }));
  }
}

/**
 * Builds query params from an options object, skipping undefined, null, false, and blank values.
 * Strings are trimmed; numbers (including 0) and `true` are sent as-is.
 */
function buildParams(values?: object): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        params = params.set(key, trimmed);
      }
    } else if (typeof value === 'number' || value === true) {
      params = params.set(key, value);
    }
  }

  return params;
}
