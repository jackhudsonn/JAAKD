import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HoldingResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class HoldingApiService {
  constructor(private httpClient: HttpClient) {}

  listByPortfolio(portfolioId: string): Promise<HoldingResponse[]> {
    return firstValueFrom(
      this.httpClient.get<HoldingResponse[]>(
        `${environment.apiUrl}/api/holdings/portfolio/${portfolioId}`,
      ),
    );
  }
}
