import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreateWatchlistItemRequest, WatchlistItemResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class WatchlistApiService {
  constructor(private httpClient: HttpClient) {}

  listByPortfolio(portfolioId: string): Promise<WatchlistItemResponse[]> {
    return firstValueFrom(
      this.httpClient.get<WatchlistItemResponse[]>(
        `${environment.apiUrl}/api/watchlists/portfolio/${portfolioId}`,
      ),
    );
  }

  add(request: CreateWatchlistItemRequest): Promise<WatchlistItemResponse> {
    return firstValueFrom(
      this.httpClient.post<WatchlistItemResponse>(`${environment.apiUrl}/api/watchlists`, request),
    );
  }

  remove(listItemId: string): Promise<void> {
    return firstValueFrom(
      this.httpClient.delete<void>(`${environment.apiUrl}/api/watchlists/${listItemId}`),
    );
  }
}