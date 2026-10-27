import { Component, computed, input, output } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { Order } from '@core/models';

@Component({
  selector: 'app-trade-history',
  standalone: true,
  imports: [
    WidgetCardComponent,
    ScrollableListComponent,
    StatusBadgeComponent,
    DisplaySymbolPipe,
    DatePipe,
    TitleCasePipe,
  ],
  templateUrl: './trade-history.component.html',
  styleUrl: './trade-history.component.css',
})
export class TradeHistoryComponent {
  orders = input.required<readonly Order[]>();

  selectOrder = output<string>();

  rows = computed(() => {
    const sorted = [...this.orders()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return sorted.map((order) => ({ order }));
  });

  trackById = (row: { order: Order }) => row.order.id;
}
