import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '@shared/components/scrollable-list/scrollable-list.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { Holding, InstrumentType } from '@core/models';
import { CASH_CURRENCIES } from '@core/models/api.models';
import { TRADE_MARKET_DATA_PORT } from '@features/trade/services/trade-market-data.port';

type HoldingsRow =
  | { kind: 'cash'; currency: string; amount: number }
  | {
      kind: 'holding';
      holding: Holding;
      price: number;
      marketValue: number;
      changePct: number;
      name: string;
    };

type HoldingsFilter = InstrumentType | 'all' | 'cash';

interface CashBalance {
  currency: string;
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
  imports: [WidgetCardComponent, ScrollableListComponent, FormsModule, DecimalPipe],
  templateUrl: './holdings-card.component.html',
  styleUrl: './holdings-card.component.css',
})
export class HoldingsCardComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(TRADE_MARKET_DATA_PORT);
  private readonly cashDisplayOrder: readonly string[] = CASH_CURRENCIES;

  readonly holdingsListMinHeight = '255px';
  readonly holdingsListMaxHeight = '255px';

  holdings = input.required<readonly Holding[]>();
  cashBalances = input<readonly CashBalance[]>([]);

  selectSymbol = output<string>();

  filterOptions = HOLDINGS_FILTER_OPTIONS;
  instrument = signal<HoldingsFilter>('all');

  private priceTick = signal(0);
  private stopTicking?: () => void;

  constructor(private router: Router) {}

  rows = computed<HoldingsRow[]>(() => {
    this.priceTick();
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
      const changePct = ((price - basePrice) / basePrice) * 100;
      rows.push({
        kind: 'holding',
        holding,
        price,
        marketValue: price * holding.quantity,
        changePct,
        name: asset?.name ?? holding.symbol,
      });
    }

    return rows;
  });

  trackByRow = (row: HoldingsRow) =>
    row.kind === 'cash' ? `cash:${row.currency}` : row.holding.symbol;

  private resolveVisibleCashBalances(): CashBalance[] {
    return this.cashBalances()
      .filter(({ amount }) => Math.abs(amount) > Number.EPSILON)
      .slice()
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

  ngOnInit() {
    this.stopTicking = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopTicking?.();
  }
}
