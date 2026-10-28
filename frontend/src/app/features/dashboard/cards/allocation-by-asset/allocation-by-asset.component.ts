import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { PieChartComponent, PieChartSlice } from '@shared/components/pie-chart/pie-chart.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { CashCurrency, CASH_CURRENCIES, REPORTING_CURRENCY } from '@core/models/api.models';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  CashRatesByUsd,
  USD_RATES_BY_USD,
  convertAmountBetweenCurrencies,
} from '@core/utils/cash-fx';
import { deterministicColorFromBase } from '@features/dashboard/utils/allocation-colors.util';
import { formatCurrency } from '@shared/utils/display-format';

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
const isPositiveRate = (rate: number | undefined): rate is number =>
  rate !== undefined && rate > 0;

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
  private readonly state = inject(DASHBOARD_STATE_PORT);
  private readonly toastService = inject(ToastService);
  private readonly notifiedUnavailableFxCurrencies = new Set<CashCurrency>();

  private readonly accountCash = this.state.accountCash;
  private readonly cashBalances = this.state.cashBalances;
  private readonly holdings = this.state.holdings;

  assetSelected = output<AllocationAssetSelection>();
  readonly displayCurrencies = CASH_CURRENCIES;
  readonly displayCurrency = signal<CashCurrency>(REPORTING_CURRENCY);
  private readonly cashRates = computed<CashRatesByUsd>(
    () => this.state.cashRatesByUsd?.() ?? USD_RATES_BY_USD,
  );
  readonly displayRateAvailable = computed(() =>
    isPositiveRate(this.cashRates()[this.displayCurrency()]),
  );

  // null == showing the top-level "by type" view.
  selectedCategory = signal<AllocationCategory | null>(null);

  constructor(private readonly router: Router) {
    effect(() => {
      const missingCurrencies = new Set(this.unavailableFxCurrencies());
      for (const currency of this.notifiedUnavailableFxCurrencies) {
        if (!missingCurrencies.has(currency)) {
          this.notifiedUnavailableFxCurrencies.delete(currency);
        }
      }

      const newlyMissing = [...missingCurrencies].filter(
        (currency) => !this.notifiedUnavailableFxCurrencies.has(currency),
      );
      if (newlyMissing.length === 0) {
        return;
      }

      newlyMissing.forEach((currency) => this.notifiedUnavailableFxCurrencies.add(currency));
      this.toastService.error(
        `FX rates unavailable for ${newlyMissing.join(', ')}; affected assets are excluded from the allocation chart.`,
      );
    });
  }

  title = computed(() => {
    const category = this.selectedCategory();
    return category ? CATEGORY_LABELS[category] : 'Allocation by Asset';
  });
  readonly formatAllocationTooltip = (usdAmount: number): string => {
    const displayAmount = this.convertDisplayAmount(usdAmount);
    return displayAmount === null
      ? 'Unavailable'
      : formatCurrency(displayAmount, this.displayCurrency());
  };

  private readonly breakdowns = computed<Record<AllocationCategory, PieChartSlice[]>>(() => {
    const byCategory: Record<AllocationCategory, PieChartSlice[]> = {
      cash: [],
      equity: [],
      etf: [],
      crypto: [],
    };

    const rates = this.cashRates();
    const balances = this.cashBalances?.() ?? { USD: this.accountCash() };
    for (const [currency, amount] of Object.entries(balances)) {
      if (Math.abs(amount) <= Number.EPSILON) {
        continue;
      }
      const cashCurrency = CASH_CURRENCIES.find((entry) => entry === currency);
      if (!cashCurrency) {
        continue;
      }

      const value = convertAmountBetweenCurrencies(amount, cashCurrency, REPORTING_CURRENCY, rates);
      if (value === null) {
        continue;
      }

      byCategory.cash.push({
        label: cashCurrency,
        value,
        color: deterministicColorFromBase(CATEGORY_COLORS.cash, cashCurrency),
      });
    }

    const bySymbol = new Map<string, { category: AllocationCategory; value: number }>();

    for (const holding of this.holdings()) {
      if (holding.indicativePrice === null || holding.indicativePrice === undefined) {
        continue;
      }

      const category: AllocationCategory = holding.instrumentType;
      const value = convertAmountBetweenCurrencies(
        holding.quantity * holding.indicativePrice,
        holding.currency ?? REPORTING_CURRENCY,
        REPORTING_CURRENCY,
        rates,
      );
      if (value === null) {
        continue;
      }

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

  private convertDisplayAmount(usdAmount: number): number | null {
    return convertAmountBetweenCurrencies(
      usdAmount,
      REPORTING_CURRENCY,
      this.displayCurrency(),
      this.cashRates(),
    );
  }

  readonly unavailableFxCurrencies = computed<CashCurrency[]>(() => {
    const rates = this.cashRates();
    const missing = new Set<CashCurrency>();
    const balances = this.cashBalances?.() ?? { USD: this.accountCash() };

    for (const [currency, amount] of Object.entries(balances)) {
      if (Math.abs(amount) <= Number.EPSILON) {
        continue;
      }
      const cashCurrency = CASH_CURRENCIES.find((entry) => entry === currency);
      if (cashCurrency && !isPositiveRate(rates[cashCurrency])) {
        missing.add(cashCurrency);
      }
    }

    for (const holding of this.holdings()) {
      if (holding.indicativePrice === null || holding.indicativePrice === undefined) {
        continue;
      }
      const currency = holding.currency ?? REPORTING_CURRENCY;
      if (!isPositiveRate(rates[currency])) {
        missing.add(currency);
      }
    }

    return [...missing];
  });

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
    return !category ? this.topLevelSlices() : this.breakdowns()[category];
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
    const price = representativeHolding?.indicativePrice;
    if (price === null || price === undefined) {
      return;
    }

    const estimatedUnits = matchingHoldings.reduce((sum, entry) => sum + entry.quantity, 0);
    const displayCurrency = this.displayCurrency();
    const rates = this.cashRates();
    let value = 0;

    for (const holding of matchingHoldings) {
      const holdingValue = convertAmountBetweenCurrencies(
        holding.quantity * (holding.indicativePrice ?? 0),
        holding.currency ?? REPORTING_CURRENCY,
        displayCurrency,
        rates,
      );
      if (holdingValue === null) {
        return;
      }
      value += holdingValue;
    }

    const displayPrice = convertAmountBetweenCurrencies(
      price,
      representativeHolding?.currency ?? REPORTING_CURRENCY,
      displayCurrency,
      rates,
    );
    if (displayPrice === null) {
      return;
    }

    this.assetSelected.emit({
      symbol: slice.label,
      price: displayPrice,
      estimatedUnits,
      value,
      currency: displayCurrency,
    });
  }

  goBack() {
    this.selectedCategory.set(null);
  }

  onDisplayCurrencyChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const currency = this.displayCurrencies.find((entry) => entry === target.value);
    if (currency) {
      this.displayCurrency.set(currency);
    }
  }
}