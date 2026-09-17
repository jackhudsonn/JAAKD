import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { ScrollableListComponent } from '../../../../shared/components/scrollable-list/scrollable-list.component';
import { startCycleTimer } from '../../../../shared/utils/cycle-timer';
import { Holding, InstrumentType } from '../../../../core/models';
import { getAsset, getMockPrice } from '../../../../core/mocks/mock-data';

type HoldingsRow =
  | { kind: 'cash'; amount: number }
  | {
      kind: 'holding';
      holding: Holding;
      price: number;
      marketValue: number;
      changePct: number;
      name: string;
    };

type HoldingsFilter = InstrumentType | 'all' | 'cash';

const HOLDINGS_FILTER_OPTIONS: { id: HoldingsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'cash', label: 'Cash' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'bond', label: 'Bonds' },
];

@Component({
  selector: 'app-holdings-card',
  standalone: true,
  imports: [WidgetCardComponent, ScrollableListComponent, FormsModule, DecimalPipe],
  templateUrl: './holdings-card.component.html',
  styleUrl: './holdings-card.component.css',
})
export class HoldingsCardComponent implements OnInit, OnDestroy {
  holdings = input.required<readonly Holding[]>();
  accountCash = input.required<number>();

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
      rows.push({ kind: 'cash', amount: this.accountCash() });
    }

    for (const holding of this.holdings()) {
      if (selectedFilter !== 'all' && selectedFilter !== holding.instrumentType) {
        continue;
      }

      const price = getMockPrice(holding.symbol);
      const asset = getAsset(holding.symbol);
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

  trackByRow = (row: HoldingsRow) => (row.kind === 'cash' ? 'cash' : row.holding.symbol);

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
