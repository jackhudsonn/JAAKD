import { Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { PieChartComponent, PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';

// TODO: confirm that these are the correct categories
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

export interface AllocationAssetSelection {
  symbol: string;
  price: number;
  estimatedUnits: number;
  value: number;
}

@Component({
  selector: 'app-allocation-by-asset-widget',
  standalone: true,
  imports: [WidgetCardComponent, PieChartComponent],
  templateUrl: './allocation-by-asset.component.html',
  styleUrl: './allocation-by-asset.component.css',
})
export class AllocationByAssetWidgetComponent {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);

  private readonly accountCash = this.state.accountCash;
  private readonly holdings = this.state.holdings;

  assetSelected = output<AllocationAssetSelection>();

  // null == showing the top-level "by type" view.
  selectedCategory = signal<AllocationCategory | null>(null);

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
      const value = holding.quantity * this.marketData.getPrice(holding.symbol);
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

    const price = this.marketData.getPrice(slice.label);
    this.assetSelected.emit({
      symbol: slice.label,
      price,
      estimatedUnits: price > 0 ? slice.value / price : 0,
      value: slice.value,
    });
  }

  goBack() {
    this.selectedCategory.set(null);
  }
}
