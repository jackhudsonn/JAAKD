import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InstrumentClass } from '@core/models/api.models';
import {
  AgeBand,
  InstrumentPerformanceResponse,
  SegmentDimension,
  SegmentExposureResponse,
  SegmentFocus,
  SegmentSummaryResponse,
  SortDirection,
} from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { WidgetCardComponent } from '@shared/components/widget-card/widget-card.component';
import {
  CLASS_COLORS,
  CLASS_LABELS,
  INSTRUMENT_CLASSES,
  formatPercent,
  formatShare,
  formatUsd,
  signClass,
  sortIndicator,
  sortRows,
} from '../analyst-format';
import { LoadState, keepsContent, loadStateFor } from '../analyst-load-state';
import { LoadStateMessageComponent } from '../load-state-message/load-state-message.component';
import {
  SegmentBarChartComponent,
  SegmentBarDataset,
} from '../segment-bar-chart/segment-bar-chart.component';

// One table row, whichever view is on: the group's overall numbers plus, with a focus, its holdings of it.
interface SegmentRow {
  segment: string;
  portfolioCount: number;
  marketValueUsd: number;
  averageReturnYtd: number | null;
  investedUsd: number;
  topClass: string | null;
  topClassShare: number | null;
  focusExposureUsd: number | null;
  focusHolders: number | null;
  focusShare: number | null;
}

type SortKey = keyof SegmentRow;

interface Column {
  key: SortKey;
  label: string;
  numeric: boolean;
}

const TOP_INSTRUMENT_COUNT = 5;

// Compares retail investors by age band or country: how their money splits across classes, how much of it is in
// a chosen class or instrument, how they've done, and what each group holds most.
@Component({
  selector: 'app-demographics-tab',
  standalone: true,
  imports: [FormsModule, WidgetCardComponent, LoadStateMessageComponent, SegmentBarChartComponent],
  templateUrl: './demographics-tab.component.html',
  styleUrls: ['../analyst.css', './demographics-tab.component.css'],
})
export class DemographicsTabComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly router = inject(Router);

  readonly classLabels = CLASS_LABELS;
  readonly focusClasses = INSTRUMENT_CLASSES.filter(
    (instrumentClass) => instrumentClass !== 'CASH',
  );
  readonly formatUsd = formatUsd;
  readonly formatPercent = formatPercent;
  readonly formatShare = formatShare;
  readonly signClass = signClass;
  readonly keepsContent = keepsContent;

  readonly dimension = signal<SegmentDimension>('ageBand');
  // The <select> value: '' (all investments), 'class:EQUITY' or 'instrument:<id>'.
  readonly focusKey = signal('');
  readonly instruments = signal<InstrumentPerformanceResponse[]>([]);

  readonly state = signal<LoadState>('loading');
  readonly segments = signal<SegmentSummaryResponse[]>([]);
  readonly exposure = signal<SegmentExposureResponse[]>([]);
  // The focus the loaded data is for; the chart and table switch only once its data has arrived.
  readonly shownFocus = signal('');
  private loadRequest = 0;

  readonly sortKey = signal<SortKey>('segment');
  readonly direction = signal<SortDirection>('asc');

  readonly selectedSegment = signal<string | null>(null);
  readonly topState = signal<LoadState>('loading');
  readonly topInstruments = signal<InstrumentPerformanceResponse[]>([]);
  private topRequest = 0;

  readonly dimensionLabel = computed(() =>
    this.dimension() === 'ageBand' ? 'Age band' : 'Country',
  );

  readonly focus = computed(() => parseFocus(this.shownFocus(), this.instruments()));

  readonly rows = computed<SegmentRow[]>(() => {
    const exposureBySegment = new Map(this.exposure().map((row) => [row.segment, row]));
    const hasFocus = this.focus() !== null;

    return this.segments().map((segment) => {
      const invested = segment.classes.reduce((sum, entry) => sum + entry.exposureUsd, 0);
      const top = segment.classes[0];
      const focus = exposureBySegment.get(segment.segment);
      return {
        segment: segment.segment,
        portfolioCount: segment.portfolioCount,
        marketValueUsd: segment.marketValueUsd,
        averageReturnYtd: segment.averageReturnYtd,
        investedUsd: invested,
        topClass: top ? CLASS_LABELS[top.instrumentClass] : null,
        topClassShare: top && invested > 0 ? top.exposureUsd / invested : null,
        focusExposureUsd: hasFocus ? (focus?.exposureUsd ?? 0) : null,
        focusHolders: hasFocus ? (focus?.holderCount ?? 0) : null,
        focusShare:
          hasFocus && focus && focus.segmentTotalUsd > 0
            ? focus.exposureUsd / focus.segmentTotalUsd
            : hasFocus
              ? 0
              : null,
      };
    });
  });

  readonly columns = computed<Column[]>(() => {
    const focus = this.focus();
    const group: Column = { key: 'segment', label: this.dimensionLabel(), numeric: false };
    if (!focus) {
      return [
        group,
        { key: 'portfolioCount', label: 'Portfolios', numeric: true },
        { key: 'marketValueUsd', label: 'Total value', numeric: true },
        { key: 'averageReturnYtd', label: 'Avg YTD return', numeric: true },
        { key: 'topClassShare', label: 'Largest class', numeric: true },
      ];
    }
    return [
      group,
      { key: 'focusHolders', label: `Holders of ${focus.label}`, numeric: true },
      { key: 'focusExposureUsd', label: `In ${focus.label}`, numeric: true },
      { key: 'focusShare', label: 'Share of group', numeric: true },
      { key: 'investedUsd', label: 'Group invested', numeric: true },
    ];
  });

  // 'segment' keeps the API's natural order (age bands youngest first, countries A→Z); reversed when descending.
  readonly sortedRows = computed(() => {
    const rows = this.rows();
    const key = this.sortKey();
    if (key === 'segment') {
      return this.direction() === 'asc' ? rows : [...rows].reverse();
    }
    return sortRows(rows, (row) => row[key] as number | null, this.direction());
  });

  readonly chartLabels = computed(() => this.rows().map((row) => row.segment));

  // No focus: each group's class mix, stacked. A focus: one bar per group, its share in that class/instrument.
  readonly chartDatasets = computed<SegmentBarDataset[]>(() => {
    const focus = this.focus();
    const rows = this.rows();
    if (focus) {
      return [
        { label: focus.label, color: focus.color, data: rows.map((row) => row.focusShare ?? 0) },
      ];
    }
    const segments = this.segments();
    return this.focusClasses
      .filter((instrumentClass) =>
        segments.some((segment) =>
          segment.classes.some(
            (entry) => entry.instrumentClass === instrumentClass && entry.exposureUsd > 0,
          ),
        ),
      )
      .map((instrumentClass) => ({
        label: CLASS_LABELS[instrumentClass],
        color: CLASS_COLORS[instrumentClass],
        data: segments.map((segment) => {
          const invested = segment.classes.reduce((sum, entry) => sum + entry.exposureUsd, 0);
          const value =
            segment.classes.find((entry) => entry.instrumentClass === instrumentClass)
              ?.exposureUsd ?? 0;
          return invested > 0 ? value / invested : 0;
        }),
      }));
  });

  readonly selectedInvested = computed(
    () => this.rows().find((row) => row.segment === this.selectedSegment())?.investedUsd ?? 0,
  );

  constructor() {
    void this.loadInstruments();

    effect(() => {
      const dimension = this.dimension();
      const focusKey = this.focusKey();
      untracked(() => void this.load(dimension, focusKey));
    });
  }

  async load(dimension = this.dimension(), focusKey = this.focusKey()) {
    const request = ++this.loadRequest;
    this.state.set('loading');
    try {
      const focus = parseFocus(focusKey, this.instruments());
      const [segments, exposure] = await Promise.all([
        this.analyticsApi.getSegments(dimension),
        focus ? this.analyticsApi.getSegmentExposure(dimension, focus.query) : Promise.resolve([]),
      ]);
      if (request !== this.loadRequest) {
        return;
      }
      this.segments.set(segments);
      this.exposure.set(exposure);
      this.shownFocus.set(focusKey);
      this.state.set('ready');

      // Keep the selected group if it's still there (e.g. after a focus change); otherwise pick the first.
      const selected = this.selectedSegment();
      const next = segments.some((segment) => segment.segment === selected)
        ? selected
        : (segments[0]?.segment ?? null);
      if (next) {
        void this.selectSegment(next);
      } else {
        this.selectedSegment.set(null);
      }
    } catch (error) {
      if (request === this.loadRequest) {
        this.state.set(loadStateFor(error));
      }
    }
  }

  // For the focus dropdown: every priced instrument, A→Z.
  private async loadInstruments() {
    try {
      const page = await this.analyticsApi.listInstruments({
        sort: 'ticker',
        direction: 'asc',
        size: 100,
      });
      this.instruments.set(page.content);
    } catch {
      // The dropdown still offers the classes; the page shows its own error if the API is down.
    }
  }

  // The group's biggest holdings; with a class focus, only that class.
  async selectSegment(segment: string) {
    this.selectedSegment.set(segment);
    const request = ++this.topRequest;
    this.topState.set('loading');
    try {
      const group =
        this.dimension() === 'ageBand' ? { ageBand: segment as AgeBand } : { country: segment };
      const page = await this.analyticsApi.listInstruments({
        ...group,
        instrumentClass: this.focus()?.query.instrumentClass,
        sort: 'exposure',
        direction: 'desc',
        size: TOP_INSTRUMENT_COUNT,
      });
      if (request === this.topRequest) {
        this.topInstruments.set(
          page.content.filter((instrument) => (instrument.exposureUsd ?? 0) > 0),
        );
        this.topState.set('ready');
      }
    } catch (error) {
      if (request === this.topRequest) {
        this.topState.set(loadStateFor(error));
      }
    }
  }

  changeDimension(dimension: SegmentDimension) {
    this.selectedSegment.set(null);
    this.sortKey.set('segment');
    this.direction.set('asc');
    this.dimension.set(dimension);
  }

  changeFocus(focusKey: string) {
    this.sortKey.set('segment');
    this.direction.set('asc');
    this.focusKey.set(focusKey);
  }

  sortBy(column: Column) {
    if (this.sortKey() === column.key) {
      this.direction.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(column.key);
      this.direction.set(column.numeric ? 'desc' : 'asc');
    }
  }

  sortIndicator(column: Column): string {
    return sortIndicator(this.sortKey() === column.key, this.direction());
  }

  openInstrument(instrument: InstrumentPerformanceResponse) {
    void this.router.navigate(['/analyst/instruments', instrument.instrumentId]);
  }

  // Share of the selected group's investments, for the bar under each top holding.
  shareOfGroup(instrument: InstrumentPerformanceResponse): number {
    const invested = this.selectedInvested();
    return invested > 0 ? (instrument.exposureUsd ?? 0) / invested : 0;
  }
}

interface Focus {
  query: SegmentFocus;
  label: string;
  color: string;
}

function parseFocus(key: string, instruments: InstrumentPerformanceResponse[]): Focus | null {
  const [kind, value] = key.split(':');
  if (kind === 'class' && value) {
    const instrumentClass = value as InstrumentClass;
    return {
      query: { instrumentClass },
      label: CLASS_LABELS[instrumentClass],
      color: CLASS_COLORS[instrumentClass],
    };
  }
  if (kind === 'instrument' && value) {
    const instrument = instruments.find((row) => row.instrumentId === value);
    return {
      query: { instrumentId: value },
      label: instrument?.ticker ?? 'instrument',
      color: instrument ? CLASS_COLORS[instrument.instrumentClass] : CLASS_COLORS.EQUITY,
    };
  }
  return null;
}
