import { Component, computed, input } from '@angular/core';
import { OrderStatus } from '@core/constants/order-status.constants';
import { formatLabel } from '@shared/utils/format-label';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
})
export class StatusBadgeComponent {
  status = input.required<OrderStatus>();

  label = computed(() => formatLabel(this.status()));
}
