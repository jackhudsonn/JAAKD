import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WidgetCardComponent } from '../../../../shared/components/widget-card/widget-card.component';
import { MOCK_PORTFOLIO_VALUE, MOCK_RETURNS } from '../../mock-data';
import { startCycleTimer } from '../../../../shared/utils/cycle-timer';

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
  private stopValueCycle?: () => void;
  private stopReturnsCycle?: () => void;

  // TODO: replace with a live account balance + position valuation stream.
  private readonly values = MOCK_PORTFOLIO_VALUE;
  // TODO: replace with a live performance/analytics endpoint (all-time + daily P&L).
  private readonly returns = MOCK_RETURNS;

  valueIndex = signal(0);
  valueFading = signal(false);

  returnsIndex = signal(0);
  returnsFading = signal(false);

  get activeValueLabel() {
    return VALUE_MODES[this.valueIndex()].label;
  }

  get activeValueAmount() {
    return this.values[VALUE_MODES[this.valueIndex()].mode];
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
  }

  ngOnDestroy() {
    this.stopValueCycle?.();
    this.stopReturnsCycle?.();
  }
}
