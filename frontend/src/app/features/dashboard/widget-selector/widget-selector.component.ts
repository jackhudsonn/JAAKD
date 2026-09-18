import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  output,
  input,
} from '@angular/core';
import {
  MAX_SELECTED_WIDGETS,
  MIN_SELECTED_WIDGETS,
  WIDGET_CATALOGUE,
  WidgetId,
} from '../dashboard-widget.model';

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
