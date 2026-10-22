import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreatePaymentMethodRequest, PaymentMethodResponse } from '@core/models/api.models';
import { environment } from '@environments/environment.local';

@Injectable({
  providedIn: 'root',
})
export class PaymentMethodApiService {
  constructor(private httpClient: HttpClient) {}

  list(): Promise<PaymentMethodResponse[]> {
    return firstValueFrom(
      this.httpClient.get<PaymentMethodResponse[]>(`${environment.apiUrl}/api/payment-methods`),
    );
  }

  create(request: CreatePaymentMethodRequest): Promise<PaymentMethodResponse> {
    return firstValueFrom(
      this.httpClient.post<PaymentMethodResponse>(
        `${environment.apiUrl}/api/payment-methods`,
        request,
      ),
    );
  }

  remove(paymentMethodId: string): Promise<void> {
    return firstValueFrom(
      this.httpClient.delete<void>(`${environment.apiUrl}/api/payment-methods/${paymentMethodId}`),
    );
  }
}
