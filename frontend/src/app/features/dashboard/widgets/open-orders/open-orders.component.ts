import { Component, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../../shared/components/scrollable-list/scrollable-list.component';
import { MOCK_STATE } from '../../../../core/mocks/mock-data';

type OpenItem =
  | {
      id: string;
      createdAt: string;
      kind: 'transaction';
      typeLabel: 'Deposit' | 'Withdrawal';
      amount: number;
      methodLabel: string;
    }
  | {
      id: string;
      createdAt: string;
      kind: 'trade';
      typeLabel: 'Buy' | 'Sell';
      symbol: string;
      quantity: number;
    };

@Component({
  selector: 'app-open-orders-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DatePipe, DecimalPipe],
  templateUrl: './open-orders.component.html',
  styleUrl: './open-orders.component.css',
})
export class OpenOrdersWidgetComponent {
  // TODO: replace with TransactionsService.getPending() + OrdersService.getOpenOrders().
  private transactions = MOCK_STATE.transactions;
  private orders = MOCK_STATE.orders;

  items = computed<OpenItem[]>(() => {
    const transactionItems: OpenItem[] = this.transactions()
      .filter((tx) => tx.status === 'pending')
      .map((tx) => ({
        id: tx.id,
        createdAt: tx.createdAt,
        kind: 'transaction' as const,
        typeLabel: tx.type === 'deposit' ? 'Deposit' : 'Withdrawal',
        amount: tx.amount,
        methodLabel: this.formatMethod(tx.method),
      }));

    const orderItems: OpenItem[] = this.orders()
      .filter((order) => order.status === 'pending' || order.status === 'open')
      .map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        kind: 'trade' as const,
        typeLabel: order.type === 'buy' ? 'Buy' : 'Sell',
        symbol: order.symbol,
        quantity: order.quantity,
      }));

    return [...transactionItems, ...orderItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });

  trackById = (item: OpenItem) => `${item.kind}-${item.id}`;

  private formatMethod(method: string) {
    return method
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
