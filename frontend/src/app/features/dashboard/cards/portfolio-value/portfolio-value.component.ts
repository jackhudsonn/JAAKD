import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { DASHBOARD_MARKET_DATA_PORT } from '@features/dashboard/services/dashboard-market-data.port';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { CASH_CURRENCIES } from '@core/models/api.models';
import { convertAmountBetweenCurrencies } from '@core/constants/cash-exchange-rates.constants';

type ValueMode = 'cash' | 'assets' | 'total';
type ReturnsMode = 'allTime' | 'daily';

const VALUE_MODES: { mode: ValueMode; label: string }[] = [
  { mode: 'total', label: 'Total Value' },
  { mode: 'cash', label: 'Cash' },
  { mode: 'assets', label: 'Assets' },
];

const RETURNS_MODES: { mode: ReturnsMode; label: string }[] = [
  { mode: 'allTime', label: 'All-Time Return' },
  { mode: 'daily', label: "Today's Return" },
];

@Component({
  selector: 'app-portfolio-value-widget',
  standalone: true,
  imports: [WidgetCardComponent, DecimalPipe],
  templateUrl: './portfolio-value.component.html',
  styleUrl: './portfolio-value.component.css',
})
export class PortfolioValueWidgetComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(DASHBOARD_MARKET_DATA_PORT);
  private readonly state = inject(DASHBOARD_STATE_PORT);

  private stopValueCycle?: () => void;
  private stopReturnsCycle?: () => void;
  private stopPriceCycle?: () => void;

  // TODO: replace with a live performance/analytics endpoint (all-time + daily P&L).
  private readonly returns = this.state.returns;
  private readonly backendDataMode = this.state.backendDataMode ?? false;

  valueIndex = signal(0);
  valueFading = signal(false);

  private priceTick = signal(0);

  returnsIndex = signal(0);
  returnsFading = signal(false);

  get activeValueLabel() {
    return VALUE_MODES[this.valueIndex()].label;
  }

  get activeValueAmount() {
    const mode = VALUE_MODES[this.valueIndex()].mode;
    const cashBalances = this.state.cashBalances?.() ?? {};
    const cash = Object.entries(cashBalances).reduce((total, [currency, amount]) => {
      const cashCurrency = CASH_CURRENCIES.find((entry) => entry === currency);
      if (!cashCurrency) {
        return total;
      }
      return total + convertAmountBetweenCurrencies(amount, cashCurrency, 'USD');
    }, 0);
    this.priceTick();
    const assets = this.state
      .holdings()
      .reduce(
        (total, holding) =>
          total +
          holding.quantity * (holding.indicativePrice ?? this.marketData.getPrice(holding.symbol)),
        0,
      );

    if (mode === 'cash') {
      return cash;
    }

    if (mode === 'assets') {
      return assets;
    }

    return cash + assets;
  }

  get activeReturnsLabel() {
    return RETURNS_MODES[this.returnsIndex()].label;
  }

  get activeReturnsAmount() {
    return this.returns[RETURNS_MODES[this.returnsIndex()].mode];
  }

  get returnsPositive() {
    return this.activeReturnsAmount >= 0;
  }

  get shouldShowReturnsUnavailableMessage() {
    return this.backendDataMode;
  }

  ngOnInit() {
    this.stopValueCycle = startCycleTimer(VALUE_MODES.length, 4000, (index) => {
      this.valueFading.set(true);
      setTimeout(() => {
        this.valueIndex.set(index);
        this.valueFading.set(false);
      }, 250);
    });

    this.stopReturnsCycle = startCycleTimer(RETURNS_MODES.length, 4000, (index) => {
      this.returnsFading.set(true);
      setTimeout(() => {
        this.returnsIndex.set(index);
        this.returnsFading.set(false);
      }, 250);
    });

    this.stopPriceCycle = startCycleTimer(1, 1000, () => this.priceTick.update((tick) => tick + 1));
  }

  ngOnDestroy() {
    this.stopValueCycle?.();
    this.stopReturnsCycle?.();
    this.stopPriceCycle?.();
  }
}
