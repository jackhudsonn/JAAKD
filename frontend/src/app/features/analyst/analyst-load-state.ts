import { HttpErrorResponse } from '@angular/common/http';
import { isAnalyticsUnavailable } from '@core/services/analytics-api.service';

// Every analyst page is in one of these states while it loads its data.
export type LoadState = 'loading' | 'ready' | 'unavailable' | 'not-found' | 'error';

/**
 * Whether a section shows its content. Only the first load swaps it for a "Loading…" message; on later loads
 * (a filter, sort or range change) the old content stays put, dimmed with the .refreshing class, so the page
 * doesn't collapse, jump to the top or rebuild its charts.
 */
export function keepsContent(state: LoadState, hasData: boolean): boolean {
  return state === 'ready' || (state === 'loading' && hasData);
}

export function loadStateFor(error: unknown): LoadState {
  if (isAnalyticsUnavailable(error)) {
    return 'unavailable';
  }
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return 'not-found';
  }
  return 'error';
}
