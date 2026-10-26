import { Component, computed, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { formatLabel } from '@shared/utils/format-label';
import { Transaction } from '@core/models';

/**
 * Renders transactions newest-first through the shared scrollable-list.
 */
@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [
    WidgetCardComponent,
    ScrollableListComponent,
    StatusBadgeComponent,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './transaction-history.component.html',
  styleUrl: './transaction-history.component.css',
})
export class TransactionHistoryComponent {
  transactions = input.required<readonly Transaction[]>();
  selectTransaction = output<string>();

  formatLabel = formatLabel;
  trackById = (transaction: Transaction) => transaction.id;

  rows = computed(() => {
    return [...this.transactions()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });
}
