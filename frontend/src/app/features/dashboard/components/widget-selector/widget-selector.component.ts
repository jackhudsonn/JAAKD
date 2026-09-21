import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  output,
  input,
} from '@angular/core';

export type WidgetId =
  | 'portfolio-value'
  | 'open-orders'
  | 'watchlist'
  | 'top-movers'
  | 'allocation-by-asset'
  | 'performance-graph'
  | 'to-be-deleted';

interface WidgetDefinition {
  id: WidgetId;
  label: string;
  /** Widgets enabled by default on first load. */
  defaultEnabled: boolean;
}

export const WIDGET_CATALOGUE: WidgetDefinition[] = [
  { id: 'performance-graph', label: 'Performance Graph', defaultEnabled: true },
  { id: 'watchlist', label: 'Watchlist', defaultEnabled: true },
  { id: 'portfolio-value', label: 'Portfolio Value & Returns', defaultEnabled: true },
  { id: 'allocation-by-asset', label: 'Allocation by Asset', defaultEnabled: true },
  { id: 'open-orders', label: 'Open Orders', defaultEnabled: false },
  { id: 'top-movers', label: 'Top Movers', defaultEnabled: false },
  { id: 'to-be-deleted', label: 'To Be Deleted', defaultEnabled: false },
];

const MIN_SELECTED_WIDGETS = 2;
const MAX_SELECTED_WIDGETS = WIDGET_CATALOGUE.length;

@Component({
  selector: 'app-widget-selector',
  standalone: true,
  templateUrl: './widget-selector.component.html',
  styleUrl: './widget-selector.component.css',
})
export class WidgetSelectorComponent {
  private elementRef = inject(ElementRef<HTMLElement>);

  selected = input.required<readonly WidgetId[]>();
  toggle = output<WidgetId>();

  open = false;
  catalogue = WIDGET_CATALOGUE;

  count = computed(() => this.selected().length);

  isChecked(id: WidgetId) {
    return this.selected().includes(id);
  }

  isDisabled(id: WidgetId) {
    const checked = this.isChecked(id);
    if (checked) {
      return this.count() <= MIN_SELECTED_WIDGETS;
    }
    return this.count() >= MAX_SELECTED_WIDGETS;
  }

  toggleOpen() {
    this.open = !this.open;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }

  onToggleWidget(id: WidgetId) {
    if (this.isDisabled(id)) {
      return;
    }
    this.toggle.emit(id);
  }
}
