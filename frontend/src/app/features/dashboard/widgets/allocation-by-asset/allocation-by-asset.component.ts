import { Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import {
  PieChartComponent,
  PieChartSlice,
} from '../../../../shared/components/pie-chart/pie-chart.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MOCK_STATE, getMockPrice } from '../../../../core/mocks/mock-data';

type AllocationCategory = 'Cash' | 'Stocks' | 'Crypto' | 'Bonds';

const CATEGORY_COLORS: Record<AllocationCategory, string> = {
  Cash: '#c6c9c7',
  Stocks: '#ff8c00',
  Crypto: '#4fc46a',
  Bonds: '#5da9ff',
};

const CATEGORY_BY_INSTRUMENT = {
  stock: 'Stocks',
  crypto: 'Crypto',
  bond: 'Bonds',
} as const;

const ASSET_COLOR_PALETTE = ['#ff8c00', '#ffa31a', '#d97700', '#4fc46a', '#7fd68f', '#2f8f45'];

@Component({
  selector: 'app-allocation-by-asset-widget',
  standalone: true,
  imports: [WidgetCardComponent, PieChartComponent, ModalComponent, DecimalPipe],
  templateUrl: './allocation-by-asset.component.html',
  styleUrl: './allocation-by-asset.component.css',
})
export class AllocationByAssetWidgetComponent {
  private readonly accountCash = MOCK_STATE.accountCash;
  private readonly holdings = MOCK_STATE.holdings;

  // null == showing the top-level "by type" view.
  selectedCategory = signal<AllocationCategory | null>(null);
  selectedAssetSlice = signal<PieChartSlice | null>(null);

  constructor(private readonly router: Router) {}

  title = computed(() =>
    this.selectedCategory() ? `${this.selectedCategory()}` : 'Allocation by Asset',
  );

  private readonly breakdowns = computed<Record<AllocationCategory, PieChartSlice[]>>(() => {
    const byCategory: Record<AllocationCategory, PieChartSlice[]> = {
      Cash: [
        {
          label: 'USD',
          value: this.accountCash(),
          color: CATEGORY_COLORS.Cash,
        },
      ],
      Stocks: [],
      Crypto: [],
      Bonds: [],
    };

    const bySymbol = new Map<string, { category: AllocationCategory; value: number }>();

    for (const holding of this.holdings()) {
      const category = CATEGORY_BY_INSTRUMENT[holding.instrumentType];
      const value = holding.quantity * getMockPrice(holding.symbol);
      const existing = bySymbol.get(holding.symbol);

      bySymbol.set(holding.symbol, {
        category,
        value: (existing?.value ?? 0) + value,
      });
    }

    let colorIndex = 0;
    for (const [symbol, entry] of bySymbol.entries()) {
      byCategory[entry.category].push({
        label: symbol,
        value: entry.value,
        color: ASSET_COLOR_PALETTE[colorIndex % ASSET_COLOR_PALETTE.length],
      });
      colorIndex += 1;
    }

    return byCategory;
  });

  private readonly topLevelSlices = computed<PieChartSlice[]>(() => {
    const breakdowns = this.breakdowns();

    return (Object.keys(breakdowns) as AllocationCategory[])
      .map((category) => ({
        label: category,
        value: breakdowns[category].reduce((sum, slice) => sum + slice.value, 0),
        color: CATEGORY_COLORS[category],
      }))
      .filter((slice) => slice.value > 0);
  });

  slices = computed<PieChartSlice[]>(() => {
    const category = this.selectedCategory();
    if (!category) {
      return this.topLevelSlices();
    }

    return this.breakdowns()[category].filter((slice) => slice.value > 0);
  });

  selectedAssetSummary = computed(() => {
    const slice = this.selectedAssetSlice();
    if (!slice) {
      return null;
    }

    const price = getMockPrice(slice.label);
    return {
      symbol: slice.label,
      price,
      estimatedUnits: price > 0 ? slice.value / price : 0,
      value: slice.value,
    };
  });

  onSliceClick(slice: PieChartSlice) {
    // Only drill down from top-level, and only when a category exists.
    const category = this.selectedCategory();

    if (!category) {
      if (
        slice.label === 'Cash' ||
        slice.label === 'Stocks' ||
        slice.label === 'Crypto' ||
        slice.label === 'Bonds'
      ) {
        this.selectedCategory.set(slice.label);
      }
      return;
    }

    if (category === 'Cash') {
      void this.router.navigate(['/transact']);
      return;
    }

    this.selectedAssetSlice.set(slice);
  }

  goBack() {
    this.selectedCategory.set(null);
    this.selectedAssetSlice.set(null);
  }

  closeAssetPopup() {
    this.selectedAssetSlice.set(null);
  }

  openTradeForSelectedAsset() {
    const selected = this.selectedAssetSummary();
    if (!selected) {
      return;
    }

    this.closeAssetPopup();
    void this.router.navigate(['/trade'], { queryParams: { symbol: selected.symbol } });
  }
}
