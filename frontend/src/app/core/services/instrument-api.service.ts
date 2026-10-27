import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  InstrumentCandleResponse,
  InstrumentResponse,
  QuoteResponse,
} from '@core/models/api.models';
import { environment } from '@environments/environment.local';

const MAX_QUOTES_PER_REQUEST = 25;
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

  getCandles(instrumentId: string, from?: string, to?: string): Promise<InstrumentCandleResponse[]> {
    return firstValueFrom(
      this.httpClient.get<InstrumentCandleResponse[]>(
        `${environment.apiUrl}/api/instruments/${instrumentId}/candles`,
        { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } },
      ),
    );
  }

  async getQuotes(symbols: string[]): Promise<QuoteResponse[]> {
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += MAX_QUOTES_PER_REQUEST) {
      chunks.push(symbols.slice(i, i + MAX_QUOTES_PER_REQUEST));
    }

    const results = await Promise.all(
      chunks.map((chunk) =>
        firstValueFrom(
          this.httpClient.get<QuoteResponse[]>(`${environment.apiUrl}/api/instruments/quotes`, {
            params: { symbols: chunk.join(',') },
          }),
        ),
      ),
    );

    return results.flat();
  }
}
