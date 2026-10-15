import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { CreateOrderLogRequest, OrderLogListResponse, OrderLogResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class OrderLogApiService {
  constructor(private httpClient: HttpClient) {}

  listByPortfolio(portfolioId: string): Promise<OrderLogResponse[]> {
    return firstValueFrom(
      this.httpClient
        .get<OrderLogListResponse>(`${environment.apiUrl}/api/order-logs/portfolio/${portfolioId}`)
        .pipe(map((response) => response.orderLogs ?? [])),
    );
  }
  submit(request: CreateOrderLogRequest): Promise<OrderLogResponse> {
    return firstValueFrom(
      this.httpClient.post<OrderLogResponse>(`${environment.apiUrl}/api/order-logs`, request),
    );
  }

  cancel(orderId: string): Promise<OrderLogResponse> {
    return firstValueFrom(
      this.httpClient.post<OrderLogResponse>(
        `${environment.apiUrl}/api/order-logs/${orderId}/cancel`,
        {},
      ),
    );
  }
}
