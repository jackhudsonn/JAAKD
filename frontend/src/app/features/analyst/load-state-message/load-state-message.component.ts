import { Component, input, output } from '@angular/core';
import { LoadState } from '../analyst-load-state';

// The message shown in place of a page's content while it isn't 'ready'.
@Component({
  selector: 'app-load-state-message',
  standalone: true,
  template: `
    @switch (state()) {
      @case ('loading') {
        <p class="state-message" role="status">Loading…</p>
      }
      @case ('unavailable') {
        <div class="state-message" role="alert">
          <p>Analytics is temporarily unavailable. Try again in a few minutes.</p>
          <button type="button" class="btn btn-secondary" (click)="retry.emit()">Retry</button>
        </div>
      }
      @case ('not-found') {
        <p class="state-message" role="alert">
          No analytics found for this {{ subject() }}. It may have been created after the last
          build.
        </p>
      }
      @case ('error') {
        <div class="state-message" role="alert">
          <p>Something went wrong loading this {{ subject() }}.</p>
          <button type="button" class="btn btn-secondary" (click)="retry.emit()">Retry</button>
        </div>
      }
    }
  `,
  styles: [
    `
      .state-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-md);

        padding: var(--space-xl) var(--space-lg);

        color: var(--text-muted);
        text-align: center;
      }

      .state-message p {
        margin: 0;
      }
    `,
  ],
})
export class LoadStateMessageComponent {
  state = input.required<LoadState>();
  // What the page shows, for the messages: "instrument", "portfolio", ...
  subject = input('page');
  retry = output<void>();
}
