import { Injectable, computed, signal } from '@angular/core';
import { PaymentMethod } from '@core/models';

export type StoredPaymentMethodType = 'bank' | 'debit_card' | 'crypto_wallet';
export type BankAccountType = 'checking' | 'savings';

interface StoredMethodBase {
  id: string;
  type: StoredPaymentMethodType;
  nickname: string;
  isDefault: boolean;
  addedAt: string;
}

export interface StoredBankAccount extends StoredMethodBase {
  type: 'bank';
  bankName: string;
  accountType: BankAccountType;
  accountLast4: string;
  routingLast4: string;
}

export interface StoredDebitCard extends StoredMethodBase {
  type: 'debit_card';
  cardBrand: string;
  cardLast4: string;
  expMonth: string;
  expYear: string;
}

export interface StoredCryptoWallet extends StoredMethodBase {
  type: 'crypto_wallet';
  network: string;
  walletPreview: string;
}

export type StoredPaymentMethod = StoredBankAccount | StoredDebitCard | StoredCryptoWallet;

export interface TransactPaymentOption {
  id: string;
  label: string;
  method: PaymentMethod;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentMethodsStore {
  private readonly methodState = signal<StoredPaymentMethod[]>([]);

  readonly methods = this.methodState.asReadonly();

  readonly transactOptions = computed<readonly TransactPaymentOption[]>(() =>
    this.methodState().map((storedMethod) => ({
      id: storedMethod.id,
      label: this.toTransactLabel(storedMethod),
      method: this.toTransactionMethod(storedMethod.type),
    })),
  );

  addBankAccount(input: {
    nickname: string;
    bankName: string;
    accountType: BankAccountType;
    accountNumber: string;
    routingNumber: string;
  }) {
    const accountDigits = input.accountNumber.replace(/\D/g, '');
    const routingDigits = input.routingNumber.replace(/\D/g, '');

    const nextMethod: StoredBankAccount = {
      id: this.makeId('bank'),
      type: 'bank',
      nickname: input.nickname,
      isDefault: this.methodState().length === 0,
      addedAt: new Date().toISOString(),
      bankName: input.bankName,
      accountType: input.accountType,
      accountLast4: accountDigits.slice(-4),
      routingLast4: routingDigits.slice(-4),
    };

    this.methodState.update((methods) => [nextMethod, ...methods]);
  }

  addDebitCard(input: {
    nickname: string;
    cardNumber: string;
    expMonth: string;
    expYear: string;
  }) {
    const cardDigits = input.cardNumber.replace(/\D/g, '');
    const cardBrand = this.detectCardBrand(cardDigits);

    const nextMethod: StoredDebitCard = {
      id: this.makeId('card'),
      type: 'debit_card',
      nickname: input.nickname,
      isDefault: this.methodState().length === 0,
      addedAt: new Date().toISOString(),
      cardBrand,
      cardLast4: cardDigits.slice(-4),
      expMonth: input.expMonth.padStart(2, '0'),
      expYear: input.expYear,
    };

    this.methodState.update((methods) => [nextMethod, ...methods]);
  }

  addCryptoWallet(input: {
    nickname: string;
    network: string;
    walletAddress: string;
  }) {
    const walletAddress = input.walletAddress.trim();

    const nextMethod: StoredCryptoWallet = {
      id: this.makeId('wallet'),
      type: 'crypto_wallet',
      nickname: input.nickname,
      isDefault: this.methodState().length === 0,
      addedAt: new Date().toISOString(),
      network: input.network,
      walletPreview: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    };

    this.methodState.update((methods) => [nextMethod, ...methods]);
  }

  setDefault(methodId: string) {
    this.methodState.update((methods) =>
      methods.map((method) => ({
        ...method,
        isDefault: method.id === methodId,
      })),
    );
  }

  removeMethod(methodId: string) {
    this.methodState.update((methods) => {
      const remaining = methods.filter((method) => method.id !== methodId);

      if (!remaining.some((method) => method.isDefault) && remaining.length > 0) {
        remaining[0] = {
          ...remaining[0],
          isDefault: true,
        };
      }

      return remaining;
    });
  }

  private toTransactionMethod(type: StoredPaymentMethodType): PaymentMethod {
    if (type === 'bank') {
      return 'bank_transfer';
    }

    if (type === 'debit_card') {
      return 'card';
    }

    return 'crypto_wallet';
  }

  private toTransactLabel(method: StoredPaymentMethod): string {
    if (method.type === 'bank') {
      return `${method.nickname} - ${method.bankName} (...${method.accountLast4})`;
    }

    if (method.type === 'debit_card') {
      return `${method.nickname} - ${method.cardBrand} (...${method.cardLast4})`;
    }

    return `${method.nickname} - ${method.network} (${method.walletPreview})`;
  }

  private detectCardBrand(cardDigits: string): string {
    if (cardDigits.startsWith('4')) {
      return 'Visa';
    }

    if (/^5[1-5]/.test(cardDigits)) {
      return 'Mastercard';
    }

    if (/^3[47]/.test(cardDigits)) {
      return 'Amex';
    }

    return 'Debit Card';
  }

  private makeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  }
}
