import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderType } from '@core/models';
import type { CashCurrency } from '@core/models/api.models';
import { REPORTING_CURRENCY } from '@core/models/api.models';
import { ToastService } from '@shared/components/toast/toast.service';
import { floorToQuantityDecimals, isValidQuantity, toOrderPreview } from './order-preview.util';
import { formatCurrency } from '@shared/utils/display-format';

export interface OrderFormSubmit {
  type: OrderType;
  quantity: number;
}

/**
 * Buy/Sell form shared by the Asset Details popup (Trade card) and the
 * Chart popup (Watchlist card). Fractional shares up to 6 decimals.
 */
@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.css',
})
export class OrderFormComponent {
  private readonly toastService = inject(ToastService);

  currentPrice = input.required<number>();
  currency = input<CashCurrency>(REPORTING_CURRENCY);
  ownedQuantity = input(0);
  accountCash = input(0);
  showBackButton = input(false);
  backLabel = input('Back');
  symbol = input('');

  placed = output<OrderFormSubmit>();
  backPressed = output<void>();
  readonly formatCurrency = formatCurrency;
  readonly reportingCurrency = REPORTING_CURRENCY;

  type = signal<OrderType>('buy');
  quantity = signal<number | null>(1);

  canSell = computed(() => this.ownedQuantity() > 0);
  readonly showPriceUnavailableHint = computed(() => this.currentPrice() <= 0);
  readonly preview = computed(() =>
    toOrderPreview({
      type: this.type(),
      quantity: this.quantity(),
      currentPrice: this.currentPrice(),
      accountCash: this.accountCash(),
    }),
  );

  // Buy cap at the quantity precision, rounded down so it never exceeds cash.
  maxBuyQuantity = computed(() => {
    const price = this.currentPrice();
    return price > 0 ? floorToQuantityDecimals(this.accountCash() / price) : 0;
  });

  error = computed(() => {
    const quantity = this.quantity();

    if (!isValidQuantity(quantity)) {
      return 'Enter a quantity greater than zero (up to 6 decimals).';
    }

    if (this.type() === 'sell' && quantity > this.ownedQuantity()) {
      return `You only own ${this.ownedQuantity()} share(s).`;
    }

    const priceUnavailableForBuy = this.type() === 'buy' && this.currentPrice() <= 0;

    if (
      !priceUnavailableForBuy &&
      this.currency() === REPORTING_CURRENCY &&
      this.type() === 'buy' &&
      quantity > this.maxBuyQuantity()
    ) {
      return 'Insufficient account cash for this quantity.';
    }

    return '';
  });

  get canPreviewCashImpact() {
    return this.currency() === REPORTING_CURRENCY;
  }

  setType(type: OrderType) {
    if (type === 'sell' && !this.canSell()) {
      return;
    }
    this.type.set(type);
  }

  submit() {
    const error = this.error();
    if (error) {
      this.toastService.error(error);
      return;
    }

    this.placed.emit({
      type: this.type(),
      quantity: this.quantity()!,
    });

    this.quantity.set(1);
  }

  reset() {
    this.type.set('buy');
    this.quantity.set(1);
  }

  onBack() {
    this.backPressed.emit();
  }
}
