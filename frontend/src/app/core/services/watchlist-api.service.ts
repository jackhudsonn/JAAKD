import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CreateWatchlistEntryRequest,
  CreateWatchlistRequest,
  UpdateWatchlistRequest,
  WatchlistItemResponse,
  WatchlistResponse,
} from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class WatchlistApiService {
  constructor(private httpClient: HttpClient) {}

  list(portfolioId: string): Promise<WatchlistResponse[]> {
    return firstValueFrom(
      this.httpClient.get<WatchlistResponse[]>(
        `${environment.apiUrl}/api/portfolios/${portfolioId}/watchlists`,
      ),
    );
  }

  createWatchlist(portfolioId: string, request: CreateWatchlistRequest): Promise<WatchlistResponse> {
    return firstValueFrom(
      this.httpClient.post<WatchlistResponse>(
        `${environment.apiUrl}/api/portfolios/${portfolioId}/watchlists`,
        request,
      ),
    );
  }

  updateWatchlist(
    portfolioId: string,
    watchlistId: string,
    request: UpdateWatchlistRequest,
  ): Promise<WatchlistResponse> {
    return firstValueFrom(
      this.httpClient.put<WatchlistResponse>(
        `${environment.apiUrl}/api/portfolios/${portfolioId}/watchlists/${watchlistId}`,
        request,
      ),
    );
  }

  deleteWatchlist(portfolioId: string, watchlistId: string): Promise<void> {
    return firstValueFrom(
      this.httpClient.delete<void>(
        `${environment.apiUrl}/api/portfolios/${portfolioId}/watchlists/${watchlistId}`,
      ),
    );
  }

  addItem(
    portfolioId: string,
    watchlistId: string,
    request: CreateWatchlistEntryRequest,
  ): Promise<WatchlistItemResponse> {
    return firstValueFrom(
      this.httpClient.post<WatchlistItemResponse>(
        `${environment.apiUrl}/api/portfolios/${portfolioId}/watchlists/${watchlistId}/items`,
        request,
      ),
    );
  }

  removeItem(portfolioId: string, watchlistId: string, listItemId: string): Promise<void> {
    return firstValueFrom(
      this.httpClient.delete<void>(
        `${environment.apiUrl}/api/portfolios/${portfolioId}/watchlists/${watchlistId}/items/${listItemId}`,
      ),
    );
  }
}
