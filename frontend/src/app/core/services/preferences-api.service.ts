import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PreferencesResponse, UpdatePreferencesRequest } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class PreferencesApiService {
  constructor(private httpClient: HttpClient) {}

  getByPortfolio(portfolioId: string): Promise<PreferencesResponse> {
    return firstValueFrom(
      this.httpClient.get<PreferencesResponse>(
        `${environment.apiUrl}/api/preferences/portfolio/${portfolioId}`,
      ),
    );
  }

  updateByPortfolio(
    portfolioId: string,
    request: UpdatePreferencesRequest,
  ): Promise<PreferencesResponse> {
    return firstValueFrom(
      this.httpClient.put<PreferencesResponse>(
        `${environment.apiUrl}/api/preferences/portfolio/${portfolioId}`,
        request,
      ),
    );
  }
}
