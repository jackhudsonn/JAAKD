import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderKind, OrderType } from '@core/models';
import { ToastService } from '@shared/components/toast/toast.service';
import { floorToQuantityDecimals, isValidQuantity, toOrderPreview } from './order-preview.util';

export interface OrderFormSubmit {
  kind: OrderKind;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
}

/**
 * Buy/Sell form shared by the Asset Details popup (Trade card) and the
 * Chart popup (Watchlist card). Fractional shares up to 6 decimals, market or limit.
 */
@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.css',
})
export class OrderFormComponent {
  private readonly toastService = inject(ToastService);

  currentPrice = input.required<number>();
  ownedQuantity = input(0);
  accountCash = input(0);
  backendDataMode = input(false);
  showBackButton = input(false);
  backLabel = input('Back');

  placed = output<OrderFormSubmit>();
  backPressed = output<void>();

  type = signal<OrderType>('buy');
  kind = signal<OrderKind>('market');
  quantity = signal<number | null>(1);
  limitPrice = signal<number | null>(null);

  canSell = computed(() => this.ownedQuantity() > 0);
  readonly showPriceUnavailableHint = computed(
    () => this.backendDataMode() && this.currentPrice() <= 0,
  );
  readonly preview = computed(() =>
    toOrderPreview({
      type: this.type(),
      kind: this.kind(),
      quantity: this.quantity(),
      limitPrice: this.limitPrice(),
      currentPrice: this.currentPrice(),
      accountCash: this.accountCash(),
    }),
  );

  constructor() {
    effect(() => {
      if (this.backendDataMode() && this.kind() !== 'market') {
        this.kind.set('market');
      }
    });
  }

  // Buy cap at the quantity precision, rounded down so it never exceeds cash,
  // based on the price that would actually be charged (limit price for limit
  // orders, current price for market).
  maxBuyQuantity = computed(() => {
    const price =
      this.kind() === 'limit' ? (this.limitPrice() ?? this.currentPrice()) : this.currentPrice();
    return price > 0 ? floorToQuantityDecimals(this.accountCash() / price) : 0;
  });

  error = computed(() => {
    const quantity = this.quantity();

    if (!isValidQuantity(quantity)) {
      return 'Enter a quantity greater than zero (up to 6 decimals).';
    }

    if (this.kind() === 'limit' && (this.limitPrice() === null || this.limitPrice()! <= 0)) {
      return 'Enter a limit price greater than zero.';
    }

    if (this.type() === 'sell' && quantity > this.ownedQuantity()) {
      return `You only own ${this.ownedQuantity()} share(s).`;
    }

    const backendPriceUnavailableForBuy =
      this.backendDataMode() && this.type() === 'buy' && this.currentPrice() <= 0;

    if (
      !backendPriceUnavailableForBuy &&
      this.type() === 'buy' &&
      quantity > this.maxBuyQuantity()
    ) {
      return 'Insufficient account cash for this quantity.';
    }

    return '';
  });

  setType(type: OrderType) {
    if (type === 'sell' && !this.canSell()) {
      return;
    }
    this.type.set(type);
  }

  setKind(kind: OrderKind) {
    if (this.backendDataMode() && kind === 'limit') {
      return;
    }

    this.kind.set(kind);
  }

  submit() {
    const error = this.error();
    if (error) {
      this.toastService.error(error);
      return;
    }

    this.placed.emit({
      kind: this.kind(),
      type: this.type(),
      quantity: this.quantity()!,
      limitPrice: this.kind() === 'limit' ? this.limitPrice()! : undefined,
    });

    this.quantity.set(1);
    this.limitPrice.set(null);
  }

  onBack() {
    this.backPressed.emit();
  }
}
