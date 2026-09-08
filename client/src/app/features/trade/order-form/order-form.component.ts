import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderKind, OrderType } from '../../../core/models';

export interface OrderFormSubmit {
  kind: OrderKind;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
}

/**
 * Buy/Sell form shared by the Asset Details popup (Trade card) and the
 * Chart popup (Watchlist card) — whole shares only, market or limit.
 */
@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.css',
})
export class OrderFormComponent {
  currentPrice = input.required<number>();
  ownedQuantity = input(0);
  accountCash = input(0);

  placed = output<OrderFormSubmit>();

  type = signal<OrderType>('buy');
  kind = signal<OrderKind>('limit');
  quantity = signal<number | null>(null);
  limitPrice = signal<number | null>(null);

  canSell = computed(() => this.ownedQuantity() > 0);

  // Whole-share cap for buy orders, based on the price that would actually
  // be charged (limit price for limit orders, current mock price for market).
  maxBuyQuantity = computed(() => {
    const price =
      this.kind() === 'limit' ? (this.limitPrice() ?? this.currentPrice()) : this.currentPrice();
    return price > 0 ? Math.floor(this.accountCash() / price) : 0;
  });

  error = computed(() => {
    const quantity = this.quantity();

    if (quantity === null || quantity <= 0 || !Number.isInteger(quantity)) {
      return 'Enter a whole number of shares greater than zero.';
    }

    if (this.kind() === 'limit' && (this.limitPrice() === null || this.limitPrice()! <= 0)) {
      return 'Enter a limit price greater than zero.';
    }

    if (this.type() === 'sell' && quantity > this.ownedQuantity()) {
      return `You only own ${this.ownedQuantity()} share(s).`;
    }

    if (this.type() === 'buy' && quantity > this.maxBuyQuantity()) {
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
    this.kind.set(kind);
  }

  submit() {
    if (this.error()) {
      return;
    }

    this.placed.emit({
      kind: this.kind(),
      type: this.type(),
      quantity: this.quantity()!,
      limitPrice: this.kind() === 'limit' ? this.limitPrice()! : undefined,
    });

    this.quantity.set(null);
    this.limitPrice.set(null);
  }
}
