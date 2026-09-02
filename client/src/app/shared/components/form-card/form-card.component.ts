import { Component, input } from '@angular/core';

/**
 * Shared card shell for standalone forms (deposit, withdrawal, order entry,
 * etc.), mirroring widget-card's header/body structure but without the
 * loading/error status states widgets need.
 */
@Component({
  selector: 'app-form-card',
  standalone: true,
  templateUrl: './form-card.component.html',
  styleUrl: './form-card.component.css',
})
export class FormCardComponent {
  title = input.required<string>();
  subtitle = input<string | null>(null);
}
