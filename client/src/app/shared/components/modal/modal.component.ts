import { Component, HostListener, input, output } from '@angular/core';

/**
 * Generic overlay/dialog shell reused by every popup on the Trade page
 * (Asset Details, Chart, Order Details). Owns the backdrop, close button,
 * and escape/backdrop-click dismissal so each popup only has to provide
 * its own content via <ng-content>.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
})
export class ModalComponent {
  title = input<string | null>(null);
  closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
