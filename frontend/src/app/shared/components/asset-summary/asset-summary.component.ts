import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { InstrumentType } from '@core/models';
import type { CashCurrency } from '@core/models/api.models';
import { DisplaySymbolPipe } from '@shared/pipes/display-symbol.pipe';
import { formatCurrency } from '@shared/utils/display-format';
import { isFlatChange, roundChangePct } from '@shared/utils/format-percentage-change';

export interface AssetSummary {
  symbol: string;
  name?: string | null;
  instrumentType?: InstrumentType | null;
  price: number | null;
  currency: CashCurrency;
  changePct?: number | null;
}

@Component({
  selector: 'app-asset-summary',
  standalone: true,
  imports: [DecimalPipe, TitleCasePipe, DisplaySymbolPipe],
  templateUrl: './asset-summary.component.html',
  styleUrl: './asset-summary.component.css',
})
export class AssetSummaryComponent {
  readonly formatCurrency = formatCurrency;

  asset = input.required<AssetSummary>();

  readonly changePct = computed(() => this.asset().changePct ?? null);
  readonly hasChange = computed(() => this.changePct() !== null);
  readonly isFlat = computed(() => {
    const changePct = this.changePct();
    return changePct === null || isFlatChange(changePct);
  });
  readonly isPositive = computed(() => (this.changePct() ?? 0) >= 0);
  readonly displayChangePct = computed(() => {
    const changePct = this.changePct();
    return changePct === null ? 0 : roundChangePct(changePct);
  });
}
