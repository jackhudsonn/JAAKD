import { Component, signal } from '@angular/core';
import { WidgetSelectorComponent } from './widget-selector/widget-selector.component';
import { PortfolioValueWidgetComponent } from './widgets/portfolio-value/portfolio-value.component';
import { OpenOrdersWidgetComponent } from './widgets/open-orders/open-orders.component';
import { WatchlistWidgetComponent } from './widgets/watchlist/watchlist.component';
import { TopMoversWidgetComponent } from './widgets/top-movers/top-movers.component';
import { AllocationByAssetWidgetComponent } from './widgets/allocation-by-asset/allocation-by-asset.component';
import { PerformanceGraphWidgetComponent } from './widgets/performance-graph/performance-graph.component';
import { ToBeDeletedWidgetComponent } from './widgets/to-be-deleted/to-be-deleted.component';
import { WIDGET_CATALOGUE, WidgetId } from './dashboard-widget.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    WidgetSelectorComponent,
    PortfolioValueWidgetComponent,
    OpenOrdersWidgetComponent,
    WatchlistWidgetComponent,
    TopMoversWidgetComponent,
    AllocationByAssetWidgetComponent,
    PerformanceGraphWidgetComponent,
    ToBeDeletedWidgetComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  // TODO: persist widget selection + order (e.g. localStorage or a
  // user-preferences API call) so it survives page reloads/sessions instead
  // of resetting to the default set/order every time.
  //
  // Order matters here: this array drives the render order in the grid.
  // Removing a widget shifts the remaining ones up; adding a widget appends
  // it to the end, letting the user effectively choose widget order by
  // toggling widgets off and back on in the order they want.
  selectedWidgets = signal<WidgetId[]>(
    WIDGET_CATALOGUE.filter((widget) => widget.defaultEnabled).map((widget) => widget.id),
  );

  // The list actually rendered in the grid. It mirrors `selectedWidgets` for
  // additions, but lags behind on removal so the exit animation can play
  // before the slot is pulled out of the DOM (which is what causes the
  // remaining cards to slide up).
  displayWidgets = signal<WidgetId[]>(this.selectedWidgets());

  // Widgets currently mid-way through their enter/leave transition, purely
  // for driving CSS classes — see dashboard.component.css.
  private enteringIds = signal<ReadonlySet<WidgetId>>(new Set());
  private leavingIds = signal<ReadonlySet<WidgetId>>(new Set());

  private static readonly EXIT_DURATION_MS = 260;

  isEntering(id: WidgetId) {
    return this.enteringIds().has(id);
  }

  isLeaving(id: WidgetId) {
    return this.leavingIds().has(id);
  }

  onToggleWidget(id: WidgetId) {
    const isSelected = this.selectedWidgets().includes(id);

    if (isSelected) {
      // Update the logical selection immediately (so the widget-selector's
      // min/max checks are correct right away)...
      this.selectedWidgets.update((current) => current.filter((widgetId) => widgetId !== id));

      // ...but animate the card out before actually removing it from the
      // rendered list, so the grid reflows smoothly instead of snapping.
      this.leavingIds.update((current) => new Set(current).add(id));

      setTimeout(() => {
        this.displayWidgets.update((current) => current.filter((widgetId) => widgetId !== id));
        this.leavingIds.update((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, DashboardComponent.EXIT_DURATION_MS);

      return;
    }

    // Append immediately so the slot exists in the grid, then flag it as
    // "entering" for one frame so the CSS transition has a starting state
    // to animate from (scaled/faded in) before settling.
    this.selectedWidgets.update((current) => [...current, id]);
    this.displayWidgets.update((current) => [...current, id]);
    this.enteringIds.update((current) => new Set(current).add(id));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.enteringIds.update((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      });
    });
  }
}
