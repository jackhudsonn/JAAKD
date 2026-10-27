import { Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import { DASHBOARD_STATE_PORT } from '@features/dashboard/services/dashboard-state.port';
import { REPORTING_CURRENCY } from '@core/models/api.models';
import { formatCurrency } from '@shared/utils/display-format';
import { isFlatChange } from '@shared/utils/format-percentage-change';
import { USD_RATES_BY_USD } from '@core/utils/cash-fx';
import {
  formatSignedPct,
  formatSignedUsd,
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

interface ValueFigures {
  cash: number;
  holdings: number | null;
  total: number | null;
}

@Component({
  selector: 'app-portfolio-value-widget',
  standalone: true,
  imports: [WidgetCardComponent, NgTemplateOutlet],
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

  // One total for the whole card, in USD. It is the card's own cash plus holdings straight away, and switches
  // to the Performance graph's last point once that request succeeds, so both cards end on the same number;
  // a slow or failed graph request never blanks the card. Holdings is total minus cash, so the line adds up.
  readonly figures = computed<ValueFigures>(() => {
    const rates = this.cashRates;
    const accountCash = this.state.accountCash();
    const cash = toCashInUsd(accountCash, this.state.cashBalances?.(), rates) ?? accountCash;
    const ownHoldings = toHoldingsValueInUsd(this.state.holdings(), rates);
    const graphTotal =
      this.state.performanceLoadState?.() === 'idle'
        ? (this.state.performance?.().at(-1)?.value ?? null)
        : null;
    const total = graphTotal ?? (ownHoldings === null ? null : cash + ownHoldings);
    return { cash, holdings: total === null ? null : total - cash, total };
  });

  get allTimeReturn(): ReturnView | null {
    const { total } = this.figures();
    const netDeposits = toNetDepositsInUsd(this.state.transactions(), this.cashRates);
    if (total === null || netDeposits === null) {
      return null;
    }

    return toReturnView(total - netDeposits, netDeposits);
  }

  // Today's gain comes from the live quotes; its % is measured against yesterday's value of the same total.
  get todayReturn(): ReturnView | null {
    const amount = toTodayReturn(
      this.state.holdings(),
      this.state.liveQuotes?.() ?? new Map(),
      this.cashRates,
    );
    if (amount === null) {
      return null;
    }

    const { total } = this.figures();
    return toReturnView(amount, total === null ? null : total - amount);
  }
}
