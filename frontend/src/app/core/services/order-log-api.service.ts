import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreateOrderLogRequest, OrderLogResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class OrderLogApiService {
  constructor(private httpClient: HttpClient) {}

  listByPortfolio(portfolioId: string): Promise<OrderLogResponse[]> {
    return firstValueFrom(
      this.httpClient.get<OrderLogResponse[]>(
        `${environment.apiUrl}/api/order-logs/portfolio/${portfolioId}`,
      ),
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
