import { Component, input } from '@angular/core';

/**
 * Thin presentational shell used by every dashboard widget.
 * Provides the consistent card chrome (title + optional subtitle/actions slot)
 * so individual widgets only need to implement their own content.
 */
@Component({
  selector: 'app-widget-card',
  standalone: true,
  templateUrl: './widget-card.component.html',
  styleUrl: './widget-card.component.css',
})
export class WidgetCardComponent {
  title = input.required<string>();
  subtitle = input<string | null>(null);
}
