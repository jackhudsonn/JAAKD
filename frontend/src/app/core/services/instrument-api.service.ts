import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { InstrumentResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class InstrumentApiService {
  constructor(private httpClient: HttpClient) {}

  list(): Promise<InstrumentResponse[]> {
    return firstValueFrom(
      this.httpClient.get<InstrumentResponse[]>(`${environment.apiUrl}/api/instruments`),
    );
  }
}
