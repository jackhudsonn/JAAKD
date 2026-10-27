import { Injectable, inject } from '@angular/core';
import { CASH_CURRENCIES, CashCurrency, QuoteResponse } from '@core/models/api.models';
import { CashRatesByUsd, invertRate, toFxSymbol, toPositiveRate } from '@core/utils/cash-fx';
import { InstrumentApiService } from './instrument-api.service';

@Injectable({
  providedIn: 'root',
})
export class CashFxService {
  private readonly instrumentApi = inject(InstrumentApiService);

  async loadRatesByUsd(): Promise<CashRatesByUsd> {
    const currencies = CASH_CURRENCIES.filter((currency) => currency !== 'USD');
    const rates: Partial<Record<CashCurrency, number>> = { USD: 1 };
    const missingRates: CashCurrency[] = [];

    const directQuotes = await this.fetchQuotes(
      currencies.map((currency) => toFxSymbol('USD', currency)),
    );
    const quotesBySymbol = this.toQuoteMap(directQuotes);

    for (const currency of currencies) {
      const rate = toPositiveRate(quotesBySymbol.get(toFxSymbol('USD', currency)));
      if (rate === null) {
        missingRates.push(currency);
      } else {
        rates[currency] = rate;
      }
    }

    if (missingRates.length === 0) {
      return rates;
    }

    const inverseQuotes = await this.fetchQuotes(
      missingRates.map((currency) => toFxSymbol(currency, 'USD')),
    );
    const inverseQuotesBySymbol = this.toQuoteMap(inverseQuotes);

    for (const currency of missingRates) {
      const rate = invertRate(
        toPositiveRate(inverseQuotesBySymbol.get(toFxSymbol(currency, 'USD'))),
      );
      if (rate !== null) {
        rates[currency] = rate;
      }
    }

    return rates;
  }

  private async fetchQuotes(symbols: string[]): Promise<QuoteResponse[]> {
    try {
      return await this.instrumentApi.getQuotes(symbols);
    } catch (error) {
      console.error('CashFxService.fetchQuotes failed', error);
      return [];
    }
  }

  private toQuoteMap(quotes: QuoteResponse[]): Map<string, QuoteResponse> {
    return new Map(quotes.map((quote) => [quote.symbol.trim().toUpperCase(), quote]));
  }
}
