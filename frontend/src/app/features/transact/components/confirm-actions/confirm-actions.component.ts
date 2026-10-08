import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-actions',
  standalone: true,
  templateUrl: './confirm-actions.component.html',
  styleUrl: './confirm-actions.component.css',
})
export class ConfirmActionsComponent {
  confirmLabel = input('Confirm');
  cancelLabel = input('Cancel');

  confirmed = output<void>();
  cancelled = output<void>();
}
