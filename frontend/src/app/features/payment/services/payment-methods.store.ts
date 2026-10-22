import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { PaymentMethod } from '@core/models';
import { BankAccountType, PaymentMethodResponse } from '@core/models/api.models';
import { PaymentMethodApiService } from '@core/services/payment-method-api.service';

export type { BankAccountType } from '@core/models/api.models';

export interface StoredBankPaymentMethod {
  id: string;
  nickname: string;
  accountHolderName: string;
  bankName: string;
  accountType: BankAccountType;
  routingNumber: string;
  accountNumberLast4: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactPaymentOption {
  id: string;
  label: string;
  method: PaymentMethod;
}

export type PaymentMethodsLoadState = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root',
})
export class PaymentMethodsStore {
  private readonly methodState = signal<StoredBankPaymentMethod[]>([]);
  private readonly loadStateSignal = signal<PaymentMethodsLoadState>('idle');
  private readonly loadErrorSignal = signal('');
  private loadInFlight: Promise<void> | null = null;

  constructor(private paymentMethodApiService: PaymentMethodApiService) {}

  readonly methods = this.methodState.asReadonly();
  readonly loadState = this.loadStateSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();

  readonly transactOptions = computed<readonly TransactPaymentOption[]>(() =>
    this.methodState().map((storedMethod) => ({
      id: storedMethod.id,
      label: `${storedMethod.nickname} - ${storedMethod.bankName} (...${storedMethod.accountNumberLast4})`,
      method: 'bank_transfer',
    })),
  );

  async load(force = false): Promise<void> {
    if (!force && this.loadInFlight) {
      return this.loadInFlight;
    }

    this.loadInFlight = (async () => {
      this.loadStateSignal.set('loading');
      this.loadErrorSignal.set('');

      try {
        const methods = await this.paymentMethodApiService.list();
        this.methodState.set(methods.map((method) => this.toStoredMethod(method)));
        this.loadStateSignal.set('ready');
      } catch (error) {
        console.error('PaymentMethodsStore.load failed', error);
        this.methodState.set([]);
        this.loadStateSignal.set('error');
        this.loadErrorSignal.set(
          this.extractErrorMessage(error, 'Unable to load payment methods.'),
        );
      }
    })().finally(() => {
      this.loadInFlight = null;
    });

    return this.loadInFlight;
  }

  async addBankAccount(input: {
    nickname: string;
    accountHolderName: string;
    bankName: string;
    accountType: BankAccountType;
    accountNumber: string;
    routingNumber: string;
  }): Promise<void> {
    try {
      const created = await this.paymentMethodApiService.create({
        nickname: input.nickname,
        accountHolderName: input.accountHolderName,
        bankName: input.bankName,
        accountType: input.accountType,
        accountNumber: input.accountNumber,
        routingNumber: input.routingNumber,
      });

      this.methodState.update((methods) => [this.toStoredMethod(created), ...methods]);
      this.loadStateSignal.set('ready');
      this.loadErrorSignal.set('');
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Unable to add payment method.'));
    }
  }

  async removeMethod(methodId: string): Promise<void> {
    try {
      await this.paymentMethodApiService.remove(methodId);
      this.methodState.update((methods) => methods.filter((method) => method.id !== methodId));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Unable to remove payment method.'));
    }
  }

  private toStoredMethod(method: PaymentMethodResponse): StoredBankPaymentMethod {
    return {
      id: method.paymentMethodId,
      nickname: method.nickname,
      accountHolderName: method.accountHolderName,
      bankName: method.bankName,
      accountType: method.accountType,
      accountNumberLast4: method.accountNumberLast4,
      routingNumber: method.routingNumber,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message =
        typeof error.error === 'object' &&
        error.error &&
        'message' in error.error &&
        typeof error.error.message === 'string'
          ? error.error.message.trim()
          : '';

      if (message.length > 0) {
        return message;
      }
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return fallback;
  }
}
