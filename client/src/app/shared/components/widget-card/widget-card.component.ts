import { Component, input, output } from '@angular/core';

export type WidgetStatus = 'idle' | 'loading' | 'error';

@Component({
  selector: 'app-widget-card',
  standalone: true,
  templateUrl: './widget-card.component.html',
  styleUrl: './widget-card.component.css',
})
export class WidgetCardComponent {
  title = input.required<string>();
  subtitle = input<string | null>(null);
  // Defaults to 'idle' so existing widgets need no changes.
  status = input<WidgetStatus>('idle');
  retry = output<void>();
}
