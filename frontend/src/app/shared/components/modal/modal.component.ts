import { DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, input, output } from '@angular/core';

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
export class ModalComponent implements OnInit, OnDestroy {
  private static openModalCount = 0;
  private static previousBodyOverflow = '';
  private static previousBodyPaddingRight = '';

  private readonly document = inject(DOCUMENT);

  title = input<string | null>(null);
  closed = output<void>();

  ngOnInit() {
    this.lockBodyScroll();
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  private lockBodyScroll() {
    const body = this.document.body;

    if (!body) {
      return;
    }

    if (ModalComponent.openModalCount === 0) {
      ModalComponent.previousBodyOverflow = body.style.overflow;
      ModalComponent.previousBodyPaddingRight = body.style.paddingRight;

      const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
      const contentWidth = this.document.documentElement.clientWidth;
      const scrollbarWidth = Math.max(0, viewportWidth - contentWidth);

      body.style.overflow = 'hidden';

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    ModalComponent.openModalCount += 1;
  }

  private unlockBodyScroll() {
    const body = this.document.body;

    if (!body || ModalComponent.openModalCount === 0) {
      return;
    }

    ModalComponent.openModalCount -= 1;

    if (ModalComponent.openModalCount === 0) {
      body.style.overflow = ModalComponent.previousBodyOverflow;
      body.style.paddingRight = ModalComponent.previousBodyPaddingRight;
    }
  }
}
