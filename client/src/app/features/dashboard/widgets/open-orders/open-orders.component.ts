import { Component, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../../shared/components/scrollable-list/scrollable-list.component';
import { MOCK_OPEN_ORDERS, MockOrder } from '../../mock-data';

@Component({
  selector: 'app-open-orders-widget',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, DecimalPipe, TitleCasePipe],
  templateUrl: './open-orders.component.html',
  styleUrl: './open-orders.component.css',
})
export class OpenOrdersWidgetComponent {
  // TODO: replace with OrdersService.getOpenOrders() and refresh on order-status events.
  orders = signal<MockOrder[]>([...MOCK_OPEN_ORDERS]);

  trackById = (order: MockOrder) => order.id;

  cancelOrder(id: string) {
    // TODO: call OrdersService.cancel(id) and reconcile with the server response
    // instead of optimistically removing the order locally.
    this.orders.update((orders) => orders.filter((order) => order.id !== id));
  }
}

