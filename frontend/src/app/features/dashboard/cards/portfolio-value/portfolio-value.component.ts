import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { startCycleTimer } from '@shared/utils/cycle-timer';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import type { CashCurrency } from '@core/models/api.models';
import { REPORTING_CURRENCY } from '@core/models/api.models';
import { formatCurrency } from '@shared/utils/display-format';

type ValueMode = 'cash' | 'assets' | 'total';

const VALUE_MODES: { mode: ValueMode; label: string }[] = [
  { mode: 'total', label: 'Total Value' },
  { mode: 'cash', label: 'Cash' },
  { mode: 'assets', label: 'Assets' },
];

@Component({
  selector: 'app-portfolio-value-widget',
  standalone: true,
  imports: [WidgetCardComponent, DecimalPipe],
  templateUrl: './portfolio-value.component.html',
  styleUrl: './portfolio-value.component.css',
})
export class PortfolioValueWidgetComponent implements OnInit, OnDestroy {
  private readonly state = inject(DASHBOARD_STATE_PORT);

  private stopValueCycle?: () => void;
  readonly formatCurrency = formatCurrency;
  readonly reportingCurrency = REPORTING_CURRENCY;

  valueIndex = signal(0);
  valueFading = signal(false);

  get activeValueLabel() {
    return VALUE_MODES[this.valueIndex()].label;
  }

  get activeValueAmount() {
    const mode = VALUE_MODES[this.valueIndex()].mode;
    const cash = this.state.accountCash();
    const assets = this.state
      .holdings()
      .reduce((total, holding) => total + holding.quantity * (holding.indicativePrice ?? 0), 0);

    if (mode === 'cash') {
      return cash;
    }

    if (mode === 'assets') {
      return assets;
    }

    return cash + assets;
  }

  get activeValueCurrency(): CashCurrency | null {
    const mode = VALUE_MODES[this.valueIndex()].mode;
    if (mode === 'cash') {
      return REPORTING_CURRENCY;
    }

    const currencies = new Set(
      this.state.holdings().map((holding) => {
        return holding.currency ?? REPORTING_CURRENCY;
      }),
    );
    if (currencies.size > 1) {
      return null;
    }

    const [assetCurrency] = currencies;
    if (mode === 'assets') {
      return assetCurrency ?? REPORTING_CURRENCY;
    }

    return assetCurrency && assetCurrency !== REPORTING_CURRENCY ? null : REPORTING_CURRENCY;
  }

  get shouldShowValueUnavailableMessage() {
    const mode = VALUE_MODES[this.valueIndex()].mode;
    return (
      mode !== 'cash' && this.state.holdings().some((holding) => holding.indicativePrice == null)
    );
  }

  ngOnInit() {
    this.stopValueCycle = startCycleTimer(VALUE_MODES.length, 4000, (index) => {
      this.valueFading.set(true);
      setTimeout(() => {
        this.valueIndex.set(index);
        this.valueFading.set(false);
      }, 250);
    });
  }

  ngOnDestroy() {
    this.stopValueCycle?.();
  }
}
