import { Component, inject } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import type { CashCurrency } from '@core/models/api.models';
import { REPORTING_CURRENCY } from '@core/models/api.models';
import { formatCurrency } from '@shared/utils/display-format';
import { isFlatChange } from '@shared/utils/format-percentage-change';
import { USD_RATES_BY_USD } from '@core/utils/cash-fx';
import {
  formatSignedPct,
  formatSignedUsd,
  toAllTimeReturn,
  toCashInUsd,
  toHoldingsValueInUsd,
  toNetDepositsInUsd,
  toReturnPct,
  toTodayReturn,
} from './portfolio-returns.util';

interface ReturnView {
  amountText: string;
  pctText: string | null;
  amount: number;
  flat: boolean;
}

const toReturnView = (amount: number, base: number | null): ReturnView => {
  const pct = toReturnPct(amount, base);
  return {
    amountText: formatSignedUsd(amount),
    pctText: pct === null ? null : formatSignedPct(pct),
    amount,
    flat: isFlatChange(amount),
  };
};

@Component({
  selector: 'app-portfolio-value-widget',
  standalone: true,
  imports: [WidgetCardComponent, DecimalPipe, NgTemplateOutlet],
  templateUrl: './portfolio-value.component.html',
  styleUrl: './portfolio-value.component.css',
})
export class PortfolioValueWidgetComponent {
  private readonly state = inject(DASHBOARD_STATE_PORT);

  readonly formatCurrency = formatCurrency;
  readonly reportingCurrency = REPORTING_CURRENCY;

  get hasReturnsData() {
    return this.state.holdings().length > 0 || this.state.transactions().length > 0;
  }

  private get cashRates() {
    return this.state.cashRatesByUsd?.() ?? USD_RATES_BY_USD;
  }

  get allTimeReturn(): ReturnView | null {
    const transactions = this.state.transactions();
    const rates = this.cashRates;
    const cash = toCashInUsd(this.state.accountCash(), this.state.cashBalances?.(), rates);
    const amount = toAllTimeReturn(cash, this.state.holdings(), transactions, rates);
    return amount === null
      ? null
      : toReturnView(amount, toNetDepositsInUsd(transactions, rates));
  }

  get todayReturn(): ReturnView | null {
    const holdings = this.state.holdings();
    const rates = this.cashRates;
    const amount = toTodayReturn(holdings, this.state.liveQuotes?.() ?? new Map(), rates);
    if (amount === null) {
      return null;
    }

    const holdingsValue = toHoldingsValueInUsd(holdings, rates);
    return toReturnView(amount, holdingsValue === null ? null : holdingsValue - amount);
  }

  get cashAmount() {
    return this.state.accountCash();
  }

  get holdingsAmount() {
    return this.state
      .holdings()
      .reduce((total, holding) => total + holding.quantity * (holding.indicativePrice ?? 0), 0);
  }

  // Null when holdings are in more than one currency, so the amount is shown without a symbol.
  get holdingsCurrency(): CashCurrency | null {
    const currencies = new Set(
      this.state.holdings().map((holding) => {
        return holding.currency ?? REPORTING_CURRENCY;
      }),
    );
    if (currencies.size > 1) {
      return null;
    }

    const [assetCurrency] = currencies;
    return assetCurrency ?? REPORTING_CURRENCY;
  }

  get holdingsPriceMissing() {
    return this.state.holdings().some((holding) => holding.indicativePrice == null);
  }

  get totalAmount() {
    return this.cashAmount + this.holdingsAmount;
  }

  // Cash is USD, so the total only gets a symbol when the holdings are USD too.
  get totalCurrency(): CashCurrency | null {
    return this.holdingsCurrency === REPORTING_CURRENCY ? REPORTING_CURRENCY : null;
  }
}
