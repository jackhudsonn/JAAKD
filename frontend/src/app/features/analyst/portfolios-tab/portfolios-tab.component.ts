import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  PortfolioPerformanceResponse,
  PortfolioSort,
  SegmentFilter,
  SortDirection,
} from '@core/models/analytics.models';
import { AnalyticsApiService } from '@core/services/analytics-api.service';
import { AuditPageResponse } from '@core/services/audit-api.service';
import { formatPercent, formatUsd, shortId, signClass, sortIndicator } from '../analyst-format';
import { LoadState, keepsContent, loadStateFor } from '../analyst-load-state';
import { LoadStateMessageComponent } from '../load-state-message/load-state-message.component';
import { SegmentFiltersComponent } from '../segment-filters/segment-filters.component';

interface Column {
  label: string;
  numeric: boolean;
  // The portfolio id has no meaningful order, so it's the one column without a sort key.
  sort?: PortfolioSort;
}

const COLUMNS: Column[] = [
  { label: 'Portfolio', numeric: false },
  { label: 'Country', numeric: false, sort: 'country' },
  { label: 'Age band', numeric: false, sort: 'ageBand' },
  { label: 'Market value', numeric: true, sort: 'marketValue' },
  { label: '1W', numeric: true, sort: 'return1w' },
  { label: '1M', numeric: true, sort: 'return1m' },
  { label: '3M', numeric: true, sort: 'return3m' },
  { label: 'YTD', numeric: true, sort: 'returnYtd' },
  { label: 'Volatility', numeric: true, sort: 'volatility' },
  { label: 'Max drawdown', numeric: true, sort: 'maxDrawdown' },
  { label: 'Realized P&L', numeric: true, sort: 'realizedPnl' },
  { label: 'Unrealized P&L', numeric: true, sort: 'unrealizedPnl' },
];

const PAGE_SIZE = 25;

@Component({
  selector: 'app-portfolios-tab',
  standalone: true,
  imports: [RouterLink, LoadStateMessageComponent, SegmentFiltersComponent],
  templateUrl: './portfolios-tab.component.html',
  styleUrl: '../analyst.css',
})
export class PortfoliosTabComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly router = inject(Router);

  readonly columns = COLUMNS;
  readonly formatUsd = formatUsd;
  readonly formatPercent = formatPercent;
  readonly signClass = signClass;
  readonly shortId = shortId;
  readonly keepsContent = keepsContent;

  readonly state = signal<LoadState>('loading');
  readonly page = signal<AuditPageResponse<PortfolioPerformanceResponse> | null>(null);

  readonly segment = signal<SegmentFilter>({});
  readonly sort = signal<PortfolioSort>('marketValue');
  readonly direction = signal<SortDirection>('desc');
  readonly pageIndex = signal(0);
  private pageRequest = 0;

  ngOnInit() {
    void this.loadPage();
  }

  async loadPage() {
    const request = ++this.pageRequest;
    this.state.set('loading');
    try {
      const page = await this.analyticsApi.listPortfolios({
        ...this.segment(),
        sort: this.sort(),
        direction: this.direction(),
        page: this.pageIndex(),
        size: PAGE_SIZE,
      });
      if (request === this.pageRequest) {
        this.page.set(page);
        this.state.set('ready');
      }
    } catch (error) {
      if (request === this.pageRequest) {
        this.state.set(loadStateFor(error));
      }
    }
  }

  changeSegment(segment: SegmentFilter) {
    this.segment.set(segment);
    this.pageIndex.set(0);
    void this.loadPage();
  }

  // Same as the instruments table: numbers start biggest first, text A→Z; clicking again reverses.
  sortBy(column: Column) {
    if (!column.sort) {
      return;
    }
    if (this.sort() === column.sort) {
      this.direction.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sort.set(column.sort);
      this.direction.set(column.numeric ? 'desc' : 'asc');
    }
    this.pageIndex.set(0);
    void this.loadPage();
  }

  goToPage(pageIndex: number) {
    this.pageIndex.set(pageIndex);
    void this.loadPage();
  }

  open(portfolio: PortfolioPerformanceResponse) {
    void this.router.navigate(['/analyst/portfolios', portfolio.portfolioId]);
  }

  sortIndicator(column: Column): string {
    return sortIndicator(!!column.sort && this.sort() === column.sort, this.direction());
  }
}
