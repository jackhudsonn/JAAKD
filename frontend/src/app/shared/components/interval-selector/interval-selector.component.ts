import { Component, computed, input, model } from '@angular/core';

@Component({
  selector: 'app-interval-selector',
  standalone: true,
  templateUrl: './interval-selector.component.html',
  styleUrl: './interval-selector.component.css',
})
export class IntervalSelectorComponent<T extends string> {
  readonly intervals = input.required<readonly T[]>();
  readonly selectedInterval = model.required<T>();
  readonly ariaLabel = input('Time range');
  readonly selectedIntervalIndex = computed(() =>
    this.intervals().indexOf(this.selectedInterval()),
  );
}
