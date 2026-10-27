import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { PieChartComponent, PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { CashCurrency, CASH_CURRENCIES, REPORTING_CURRENCY } from '@core/models/api.models';
import { convertAmountBetweenCurrencies } from '@core/constants/cash-exchange-rates.constants';
import { deterministicColorFromBase } from '@features/dashboard/utils/allocation-colors.util';

const ALLOCATION_CATEGORIES = ['cash', 'equity', 'etf', 'crypto'] as const;
type AllocationCategory = (typeof ALLOCATION_CATEGORIES)[number];

const CATEGORY_LABELS: Record<AllocationCategory, string> = {
  cash: 'Cash',
  equity: 'Equity',
  etf: 'ETF',
  crypto: 'Crypto',
};

const CATEGORY_COLORS: Record<AllocationCategory, string> = {
  cash: '#2ECC71',
  equity: '#3498DB',
  etf: '#9B59B6',
  crypto: '#E67E22',
};
const CURRENCY_SYMBOLS: Record<CashCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export interface AllocationAssetSelection {
  symbol: string;
  price: number;
  estimatedUnits: number;
  value: number;
  currency: CashCurrency;
}

interface UnavailablePriceHolding {
  symbol: string;
  quantity: number;
}

@Component({
  selector: 'app-allocation-by-asset-widget',
  standalone: true,
  imports: [WidgetCardComponent, PieChartComponent, DecimalPipe, DisplaySymbolPipe],
  templateUrl: './allocation-by-asset.component.html',
  styleUrl: './allocation-by-asset.component.css',
})
export class AllocationByAssetWidgetComponent {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);

  private readonly accountCash = this.state.accountCash;
  private readonly cashBalances = this.state.cashBalances;
  private readonly holdings = this.state.holdings;

  assetSelected = output<AllocationAssetSelection>();
  readonly displayCurrencies = CASH_CURRENCIES;
  readonly displayCurrency = signal<CashCurrency>(REPORTING_CURRENCY);

  // null == showing the top-level "by type" view.
  selectedCategory = signal<AllocationCategory | null>(null);

  constructor(private readonly router: Router) {}

  title = computed(() => {
    const category = this.selectedCategory();
    return category ? CATEGORY_LABELS[category] : 'Allocation by Asset';
  });
  readonly tooltipValuePrefix = computed(() => CURRENCY_SYMBOLS[this.displayCurrency()]);

  private readonly breakdowns = computed<Record<AllocationCategory, PieChartSlice[]>>(() => {
    const byCategory: Record<AllocationCategory, PieChartSlice[]> = {
      cash: [],
      equity: [],
      etf: [],
      crypto: [],
    };

    const balances = this.cashBalances?.() ?? { USD: this.accountCash() };
    for (const [currency, amount] of Object.entries(balances)) {
      if (Math.abs(amount) <= Number.EPSILON) {
        continue;
      }
      const cashCurrency = CASH_CURRENCIES.find((entry) => entry === currency);
      if (!cashCurrency) {
        continue;
      }

      byCategory.cash.push({
        label: cashCurrency,
        value: convertAmountBetweenCurrencies(amount, cashCurrency, REPORTING_CURRENCY),
        color: deterministicColorFromBase(CATEGORY_COLORS.cash, cashCurrency),
      });
    }

    const bySymbol = new Map<string, { category: AllocationCategory; value: number }>();

    for (const holding of this.holdings()) {
      const category: AllocationCategory = holding.instrumentType;
      const value =
        holding.quantity * (holding.indicativePrice ?? this.marketData.getPrice(holding.symbol));
      const existing = bySymbol.get(holding.symbol);

      bySymbol.set(holding.symbol, {
        category,
        value: (existing?.value ?? 0) + value,
      });
    }

    for (const [symbol, entry] of bySymbol.entries()) {
      byCategory[entry.category].push({
        label: symbol,
        value: entry.value,
        color: deterministicColorFromBase(CATEGORY_COLORS[entry.category], symbol),
      });
    }

    return byCategory;
  });

  private convertDisplayAmount(usdAmount: number) {
    return convertAmountBetweenCurrencies(usdAmount, REPORTING_CURRENCY, this.displayCurrency());
  }

  private readonly topLevelSlices = computed<PieChartSlice[]>(() => {
    const breakdowns = this.breakdowns();

    return ALLOCATION_CATEGORIES.map((category) => ({
      label: category,
      value: breakdowns[category].reduce((sum, slice) => sum + slice.value, 0),
      color: CATEGORY_COLORS[category],
    })).filter((slice) => breakdowns[slice.label].length > 0);
  });

  slices = computed<PieChartSlice[]>(() => {
    const category = this.selectedCategory();
    const sourceSlices = !category ? this.topLevelSlices() : this.breakdowns()[category];
    return sourceSlices.map((slice) => ({
      ...slice,
      value: this.convertDisplayAmount(slice.value),
    }));
  });

  unavailablePriceHoldings = computed<UnavailablePriceHolding[]>(() => {
    const category = this.selectedCategory();
    const rows: UnavailablePriceHolding[] = [];

    for (const holding of this.holdings()) {
      const holdingCategory: AllocationCategory = holding.instrumentType;
      const matchesCategory = !category || holdingCategory === category;
      if (!matchesCategory || holding.priceStatus !== 'price unavailable') {
        continue;
      }

      rows.push({
        symbol: holding.symbol,
        quantity: holding.quantity,
      });
    }

    return rows;
  });

  onSliceClick(slice: PieChartSlice) {
    // Only drill down from top-level, and only when a category exists.
    const category = this.selectedCategory();

    if (!category) {
      const clicked = ALLOCATION_CATEGORIES.find((entry) => entry === slice.label);
      if (clicked) {
        this.selectedCategory.set(clicked);
      }
      return;
    }

    if (category === 'cash') {
      void this.router.navigate(['/transact']);
      return;
    }
    const matchingHoldings = this.holdings().filter((entry) => entry.symbol === slice.label);
    const representativeHolding = matchingHoldings[0];
    const price = representativeHolding?.indicativePrice ?? this.marketData.getPrice(slice.label);
    const estimatedUnits = matchingHoldings.reduce((sum, entry) => sum + entry.quantity, 0);
    const valueInUsd = matchingHoldings.reduce(
      (sum, entry) =>
        sum + entry.quantity * (entry.indicativePrice ?? this.marketData.getPrice(entry.symbol)),
      0,
    );
    const displayCurrency = this.displayCurrency();

    this.assetSelected.emit({
      symbol: slice.label,
      price: convertAmountBetweenCurrencies(price, REPORTING_CURRENCY, displayCurrency),
      estimatedUnits,
      value: convertAmountBetweenCurrencies(valueInUsd, REPORTING_CURRENCY, displayCurrency),
      currency: displayCurrency,
    });
  }

  goBack() {
    this.selectedCategory.set(null);
  }

  toggleDisplayCurrency() {
    const currentIndex = this.displayCurrencies.indexOf(this.displayCurrency());
    const nextCurrency =
      this.displayCurrencies[(currentIndex + 1) % this.displayCurrencies.length] ??
      REPORTING_CURRENCY;
    this.displayCurrency.set(nextCurrency);
  }
}
