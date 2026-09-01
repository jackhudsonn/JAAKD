import { Component, computed, signal } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { PieChartComponent, PieChartSlice } from '../../../../shared/components/pie-chart/pie-chart.component';
import { MOCK_ALLOCATION_BY_ASSET, MOCK_ALLOCATION_BY_TYPE } from '../../mock-data';

@Component({
  selector: 'app-allocation-by-asset-widget',
  standalone: true,
  imports: [WidgetCardComponent, PieChartComponent],
  templateUrl: './allocation-by-asset.component.html',
  styleUrl: './allocation-by-asset.component.css',
})
export class AllocationByAssetWidgetComponent {
  // TODO: replace both mock sources with a single portfolio allocation
  // endpoint that can return either the top-level breakdown or a specific
  // category's holdings breakdown, e.g. GET /portfolio/allocation[?category=].
  private readonly typeSlices = MOCK_ALLOCATION_BY_TYPE;
  private readonly categoryBreakdowns = MOCK_ALLOCATION_BY_ASSET;

  // null == showing the top-level "by type" view.
  selectedCategory = signal<string | null>(null);

  title = computed(() =>
    this.selectedCategory() ? `${this.selectedCategory()}` : 'Allocation by Asset',
  );

  slices = computed<PieChartSlice[]>(() => {
    const category = this.selectedCategory();
    if (!category) {
      return this.typeSlices;
    }
    return this.categoryBreakdowns[category] ?? [];
  });

  onSliceClick(slice: PieChartSlice) {
    // Only drill down from the top-level view, and only into categories we
    // actually have a per-asset breakdown for.
    if (!this.selectedCategory() && this.categoryBreakdowns[slice.label]) {
      this.selectedCategory.set(slice.label);
    }
  }

  goBack() {
    this.selectedCategory.set(null);
  }
}

