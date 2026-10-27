import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { Holding, InstrumentType } from '@core/models';
import { CASH_CURRENCIES } from '@core/models/api.models';
import type { CashCurrency } from '@core/models/api.models';
import { TRADE_MARKET_DATA_PORT } from '@features/trade/services/trade-market-data.port';
import { isFlatChange } from '@shared/utils/format-percentage-change';
import { formatCurrency } from '@shared/utils/display-format';

type HoldingsRow =
  | { kind: 'cash'; currency: CashCurrency; amount: number }
  | {
      kind: 'holding';
      holding: Holding;
      price: number | null;
      marketValue: number | null;
      changePct: number | null;
      flat: boolean;
      name: string;
      currency: CashCurrency;
    };

type HoldingsFilter = InstrumentType | 'all' | 'cash';

interface CashBalance {
  currency: CashCurrency;
  amount: number;
}

const HOLDINGS_FILTER_OPTIONS: { id: HoldingsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'cash', label: 'Cash' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'equity', label: 'Equities' },
  { id: 'etf', label: 'ETFs' },
];

@Component({
  selector: 'app-holdings-card',
  standalone: true,
  imports: [
    WidgetCardComponent,
    ScrollableListComponent,
    FormsModule,
    DecimalPipe,
    DisplaySymbolPipe,
  ],
  templateUrl: './holdings-card.component.html',
  styleUrl: './holdings-card.component.css',
})
export class HoldingsCardComponent {
  private readonly marketData = inject(TRADE_MARKET_DATA_PORT);
  private readonly cashDisplayOrder: readonly string[] = CASH_CURRENCIES;

  readonly holdingsListMinHeight = '325px';
  readonly holdingsListMaxHeight = '325px';

  holdings = input.required<readonly Holding[]>();
  cashBalances = input<readonly CashBalance[] | null>(null);

  selectSymbol = output<string>();

  filterOptions = HOLDINGS_FILTER_OPTIONS;
  instrument = signal<HoldingsFilter>('all');
  readonly formatCurrency = formatCurrency;

  constructor(private router: Router) {}

  rows = computed<HoldingsRow[]>(() => {
    const selectedFilter = this.instrument();
    const rows: HoldingsRow[] = [];

    if (selectedFilter === 'all' || selectedFilter === 'cash') {
      const cashRows = this.resolveVisibleCashBalances().map(({ currency, amount }) => ({
        kind: 'cash' as const,
        currency,
        amount,
      }));
      rows.push(...cashRows);
    }

    for (const holding of this.holdings()) {
      if (selectedFilter !== 'all' && selectedFilter !== holding.instrumentType) {
        continue;
      }

      const price = this.marketData.getPrice(holding.symbol);
      const asset = this.marketData.getAsset(holding.symbol);
      const basePrice = asset?.basePrice ?? price;
      const currentPrice = holding.indicativePrice ?? price;
      const changePct =
        currentPrice !== null && basePrice !== null && basePrice > 0
          ? ((currentPrice - basePrice) / basePrice) * 100
          : null;
      rows.push({
        kind: 'holding',
        holding,
        price: currentPrice,
        marketValue: currentPrice === null ? null : currentPrice * holding.quantity,
        changePct,
        flat: changePct === null || isFlatChange(changePct),
        name: asset?.name ?? holding.symbol,
        currency: asset?.currency ?? holding.currency ?? 'USD',
      });
    }

    return rows;
  });

  trackByRow = (row: HoldingsRow) =>
    row.kind === 'cash' ? `cash:${row.currency}` : row.holding.symbol;

  private resolveVisibleCashBalances(): CashBalance[] {
    const balances = this.cashBalances() ?? [];

    return balances
      .flatMap(({ currency, amount }) => {
        const supportedCurrency = CASH_CURRENCIES.find((entry) => entry === currency);
        return supportedCurrency ? [{ currency: supportedCurrency, amount }] : [];
      })
      .filter(({ amount }) => Math.abs(amount) > Number.EPSILON)
      .sort((left, right) => this.compareCashBalances(left, right));
  }

  private compareCashBalances(left: CashBalance, right: CashBalance) {
    const leftPriority = this.cashDisplayOrder.indexOf(left.currency.toUpperCase());
    const rightPriority = this.cashDisplayOrder.indexOf(right.currency.toUpperCase());

    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) {
        return 1;
      }
      if (rightPriority === -1) {
        return -1;
      }
      return leftPriority - rightPriority;
    }

    return left.currency.localeCompare(right.currency);
  }

  setInstrument(type: HoldingsFilter) {
    this.instrument.set(type);
  }

  goToTransact() {
    this.router.navigate(['/transact']);
  }
}
