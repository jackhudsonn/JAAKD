import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PortfolioResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class PortfolioApiService {
  private ensureDefaultInFlight: Promise<PortfolioResponse> | null = null;

  constructor(private httpClient: HttpClient) {}

  list(): Promise<PortfolioResponse[]> {
    return firstValueFrom(
      this.httpClient.get<PortfolioResponse[]>(`${environment.apiUrl}/api/portfolios`),
    );
  }

  create(portfolioName: string): Promise<PortfolioResponse> {
    return firstValueFrom(
      this.httpClient.post<PortfolioResponse>(`${environment.apiUrl}/api/portfolios`, {
        portfolioName,
      }),
    );
  }

  ensureDefault(): Promise<PortfolioResponse> {
    if (this.ensureDefaultInFlight) {
      return this.ensureDefaultInFlight;
    }

    this.ensureDefaultInFlight = (async () => {
      const portfolios = await this.list();
      if (portfolios.length > 0) {
        return portfolios[0];
      }

      return this.create('Main');
    })().finally(() => {
      this.ensureDefaultInFlight = null;
    });

    return this.ensureDefaultInFlight;
  }
}
