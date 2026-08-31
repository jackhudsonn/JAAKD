// Widget catalogue for the dashboard widget picker.
// TODO: once user preferences are persisted (see dashboard.component.ts),
// this list can also drive ordering/config coming from the backend.

export type WidgetId =
  | 'portfolio-value'
  | 'open-orders'
  | 'watchlist'
  | 'top-movers'
  | 'allocation-by-asset'
  | 'performance-graph';

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  /** Widgets enabled by default on first load. */
  defaultEnabled: boolean;
}

export const WIDGET_CATALOGUE: WidgetDefinition[] = [
  { id: 'performance-graph', label: 'Performance Graph', defaultEnabled: true },
  { id: 'portfolio-value', label: 'Portfolio Value & Returns', defaultEnabled: true },
  { id: 'watchlist', label: 'Watchlist', defaultEnabled: true },
  { id: 'allocation-by-asset', label: 'Allocation by Asset', defaultEnabled: true },
  { id: 'open-orders', label: 'Open Orders', defaultEnabled: false },
  { id: 'top-movers', label: 'Top Movers', defaultEnabled: false },
];

export const MIN_SELECTED_WIDGETS = 2;
// NOTE: bump this alongside WIDGET_CATALOGUE as more widgets are added.
export const MAX_SELECTED_WIDGETS = WIDGET_CATALOGUE.length;
