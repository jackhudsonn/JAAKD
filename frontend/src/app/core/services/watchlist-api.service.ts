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

  list(): Promise<WatchlistResponse[]> {
    return firstValueFrom(
      this.httpClient.get<WatchlistResponse[]>(`${environment.apiUrl}/api/watchlists`),
    );
  }

  createWatchlist(request: CreateWatchlistRequest): Promise<WatchlistResponse> {
    return firstValueFrom(
      this.httpClient.post<WatchlistResponse>(`${environment.apiUrl}/api/watchlists`, request),
    );
  }

  updateWatchlist(watchlistId: string, request: UpdateWatchlistRequest): Promise<WatchlistResponse> {
    return firstValueFrom(
      this.httpClient.put<WatchlistResponse>(
        `${environment.apiUrl}/api/watchlists/${watchlistId}`,
        request,
      ),
    );
  }

  deleteWatchlist(watchlistId: string): Promise<void> {
    return firstValueFrom(
      this.httpClient.delete<void>(`${environment.apiUrl}/api/watchlists/${watchlistId}`),
    );
  }

  addItem(watchlistId: string, request: CreateWatchlistEntryRequest): Promise<WatchlistItemResponse> {
    return firstValueFrom(
      this.httpClient.post<WatchlistItemResponse>(
        `${environment.apiUrl}/api/watchlists/${watchlistId}/items`,
        request,
      ),
    );
  }

  removeItem(watchlistId: string, listItemId: string): Promise<void> {
    return firstValueFrom(
      this.httpClient.delete<void>(`${environment.apiUrl}/api/watchlists/${watchlistId}/items/${listItemId}`),
    );
  }
}
