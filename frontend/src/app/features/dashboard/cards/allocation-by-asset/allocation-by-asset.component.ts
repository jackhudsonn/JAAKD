import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { PieChartComponent, PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { CashCurrency, CASH_CURRENCIES } from '@core/models/api.models';
import {
  convertAmountBetweenCurrencies,
} from '@core/constants/cash-exchange-rates.constants';
import { deterministicColorFromBase } from '@features/dashboard/utils/allocation-colors.util';

type AllocationCategory = 'CASH' | 'EQUITY' | 'ETF' | 'CRYPTO';

const CATEGORY_COLORS: Record<AllocationCategory, string> = {
  CASH: '#2ECC71',
  EQUITY: '#3498DB',
  ETF: '#9B59B6',
  CRYPTO: '#E67E22',
};

const CATEGORY_BY_INSTRUMENT_CLASS = {
  EQUITY: 'EQUITY',
  ETF: 'ETF',
  CRYPTO: 'CRYPTO',
} as const;

const CATEGORY_BY_INSTRUMENT_TYPE = {
  equity: 'EQUITY',
  etf: 'ETF',
  crypto: 'CRYPTO',
} as const;
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
  imports: [WidgetCardComponent, PieChartComponent, DecimalPipe],
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
  readonly displayCurrency = signal<CashCurrency>('USD');

  // null == showing the top-level "by type" view.
  selectedCategory = signal<AllocationCategory | null>(null);

  constructor(private readonly router: Router) {}

  title = computed(() =>
    this.selectedCategory() ? `${this.selectedCategory()}` : 'Allocation by Asset',
  );
  readonly tooltipValuePrefix = computed(() => CURRENCY_SYMBOLS[this.displayCurrency()]);

  private readonly breakdowns = computed<Record<AllocationCategory, PieChartSlice[]>>(() => {
    const byCategory: Record<AllocationCategory, PieChartSlice[]> = {
      CASH: [],
      EQUITY: [],
      ETF: [],
      CRYPTO: [],
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

      byCategory.CASH.push({
        label: cashCurrency,
        value: convertAmountBetweenCurrencies(amount, cashCurrency, 'USD'),
        color: deterministicColorFromBase(CATEGORY_COLORS.CASH, cashCurrency),
      });
    }

    const bySymbol = new Map<string, { category: AllocationCategory; value: number }>();

    for (const holding of this.holdings()) {
      const category =
        (holding.instrumentClass && CATEGORY_BY_INSTRUMENT_CLASS[holding.instrumentClass]) ||
        CATEGORY_BY_INSTRUMENT_TYPE[holding.instrumentType];
      if (!category) {
        continue;
      }
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
    return convertAmountBetweenCurrencies(usdAmount, 'USD', this.displayCurrency());
  }

  private readonly topLevelSlices = computed<PieChartSlice[]>(() => {
    const breakdowns = this.breakdowns();

    return (Object.keys(breakdowns) as AllocationCategory[])
      .map((category) => ({
        label: category,
        value: breakdowns[category].reduce((sum, slice) => sum + slice.value, 0),
        color: CATEGORY_COLORS[category],
      }))
      .filter(
        (slice) => slice.value > 0 || breakdowns[slice.label as AllocationCategory].length > 0,
      );
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
      const holdingCategory =
        (holding.instrumentClass && CATEGORY_BY_INSTRUMENT_CLASS[holding.instrumentClass]) ||
        CATEGORY_BY_INSTRUMENT_TYPE[holding.instrumentType];
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
      if (
        slice.label === 'CASH' ||
        slice.label === 'EQUITY' ||
        slice.label === 'ETF' ||
        slice.label === 'CRYPTO'
      ) {
        this.selectedCategory.set(slice.label);
      }
      return;
    }

    if (category === 'CASH') {
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
      price: convertAmountBetweenCurrencies(price, 'USD', displayCurrency),
      estimatedUnits,
      value: convertAmountBetweenCurrencies(valueInUsd, 'USD', displayCurrency),
      currency: displayCurrency,
    });
  }

  goBack() {
    this.selectedCategory.set(null);
  }

  toggleDisplayCurrency() {
    const currentIndex = this.displayCurrencies.indexOf(this.displayCurrency());
    const nextCurrency =
      this.displayCurrencies[(currentIndex + 1) % this.displayCurrencies.length] ?? 'USD';
    this.displayCurrency.set(nextCurrency);
  }
}
