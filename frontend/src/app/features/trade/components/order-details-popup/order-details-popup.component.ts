import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ORDER_STATUS } from '@core/constants/order-status.constants';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { formatLabel } from '@shared/utils/format-label';
import { Order } from '@core/models';
import { OrderLogResponse } from '@core/models/api.models';
import { extractStatusReason } from '@features/dashboard/services/dashboard-backend.mappers';
import { formatCurrency } from '@shared/utils/display-format';

@Component({
  selector: 'app-order-details-popup',
  standalone: true,
  imports: [
    ModalComponent,
    StatusBadgeComponent,
    DatePipe,
    TitleCasePipe,
    DisplaySymbolPipe,
  ],
  templateUrl: './order-details-popup.component.html',
  styleUrl: './order-details-popup.component.css',
})
export class OrderDetailsPopupComponent {
  order = input.required<Order>();
  history = input.required<readonly OrderLogResponse[]>();

  closed = output<void>();
  cancel = output<string>();

  private readonly selectedHistoryEventId = signal<string | null>(null);

  readonly orderedHistory = computed(() =>
    [...this.history()].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() ||
        a.logOrderId.localeCompare(b.logOrderId),
    ),
  );
  readonly selectedHistoryIndex = computed(() => {
    const history = this.orderedHistory();
    const selectedEventId = this.selectedHistoryEventId();
    const selectedIndex = selectedEventId
      ? history.findIndex((event) => event.logOrderId === selectedEventId)
      : -1;
    return selectedIndex >= 0 ? selectedIndex : history.length - 1;
  });
  readonly selectedEvent = computed(
    () => this.orderedHistory()[this.selectedHistoryIndex()] ?? null,
  );
  readonly selectedStatus = computed(() => this.selectedEvent()?.status ?? this.order().status);
  readonly selectedTimestamp = computed(
    () => this.selectedEvent()?.timestamp ?? this.order().createdAt,
  );
  readonly selectedQuotedPrice = computed(() =>
    this.formatPrice(this.selectedEvent()?.quotedPrice),
  );
  readonly selectedExecutionPrice = computed(() => {
    if (this.selectedStatus() !== 'EXECUTED') {
      return '-';
    }

    return this.formatPrice(
      this.selectedEvent()?.executionPrice ?? this.order().fillPrice,
    );
  });
  readonly selectedReason = computed(() => {
    const event = this.selectedEvent();
    const status = event?.status ?? this.order().status;
    if (!this.isErrorStatus(status)) {
      return null;
    }

    return event
      ? this.extractStatusReason(event.metadata)
      : (this.order().statusReason ?? 'The order could not be completed.');
  });
  readonly canGoToPreviousStatus = computed(() => this.selectedHistoryIndex() > 0);
  readonly canGoToNextStatus = computed(
    () => this.selectedHistoryIndex() < this.orderedHistory().length - 1,
  );

  formatLabel = formatLabel;
  extractStatusReason = extractStatusReason;

  isErrorStatus(status: OrderLogResponse['status']): boolean {
    return status === 'REJECTED' || status === 'FAILED';
  }

  private formatPrice(price: number | null | undefined): string {
    if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) {
      return '-';
    }

    return formatCurrency(price, this.order().currency ?? 'USD');
  }

  canCancelOrder() {
    const status = this.order().status;
    return (
      status === ORDER_STATUS.SUBMITTED ||
      status === ORDER_STATUS.PENDING ||
      status === ORDER_STATUS.ACCEPTED
    );
  }

  showPreviousStatus() {
    const previousEvent = this.orderedHistory()[this.selectedHistoryIndex() - 1];
    if (previousEvent) {
      this.selectedHistoryEventId.set(previousEvent.logOrderId);
    }
  }

  showNextStatus() {
    const nextEvent = this.orderedHistory()[this.selectedHistoryIndex() + 1];
    if (nextEvent) {
      this.selectedHistoryEventId.set(nextEvent.logOrderId);
    }
  }
}
