import { Component, ElementRef, signal, viewChild, viewChildren } from '@angular/core';
import { WidgetSelectorComponent } from './components/widget-selector/widget-selector.component';
import { PortfolioValueWidgetComponent } from './widgets/portfolio-value/portfolio-value.component';
import { OpenOrdersWidgetComponent } from './widgets/open-orders/open-orders.component';
import { WatchlistWidgetComponent } from './widgets/watchlist/watchlist.component';
import { TopMoversWidgetComponent } from './widgets/top-movers/top-movers.component';
import { AllocationByAssetWidgetComponent } from './widgets/allocation-by-asset/allocation-by-asset.component';
import { PerformanceGraphWidgetComponent } from './widgets/performance-graph/performance-graph.component';
import { ToBeDeletedWidgetComponent } from './widgets/to-be-deleted/to-be-deleted.component';
import { DashboardOverlaysComponent } from './components/overlays/dashboard-overlays.component';
import { WidgetId, WIDGET_CATALOGUE } from './components/widget-selector/widget-selector.component';

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
    DashboardOverlaysComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  readonly overlays = viewChild(DashboardOverlaysComponent);

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

  private readonly widgetSlots = viewChildren<ElementRef<HTMLElement>>('widgetSlot');

  private static readonly EXIT_DURATION_MS = 260;
  private static readonly REFLOW_DURATION_MS = 320;
  private static readonly REFLOW_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

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
        this.animateWidgetReflow(() => {
          this.displayWidgets.update((current) => current.filter((widgetId) => widgetId !== id));
        });

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
    this.animateWidgetReflow(() => {
      this.displayWidgets.update((current) => [...current, id]);
    });

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

  private captureSlotPositions() {
    const positions = new Map<WidgetId, DOMRect>();

    for (const slotRef of this.widgetSlots()) {
      const slotEl = slotRef.nativeElement;
      const widgetId = slotEl.dataset['widgetId'] as WidgetId | undefined;

      if (!widgetId) {
        continue;
      }

      positions.set(widgetId, slotEl.getBoundingClientRect());
    }

    return positions;
  }

  private animateWidgetReflow(mutate: () => void) {
    const before = this.captureSlotPositions();

    mutate();

    requestAnimationFrame(() => {
      const entering = this.enteringIds();
      const leaving = this.leavingIds();

      for (const slotRef of this.widgetSlots()) {
        const slotEl = slotRef.nativeElement;
        const widgetId = slotEl.dataset['widgetId'] as WidgetId | undefined;

        if (!widgetId || !before.has(widgetId) || entering.has(widgetId) || leaving.has(widgetId)) {
          continue;
        }

        const from = before.get(widgetId);

        if (!from) {
          continue;
        }

        const to = slotEl.getBoundingClientRect();
        const deltaX = from.left - to.left;
        const deltaY = from.top - to.top;

        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
          continue;
        }

        slotEl.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          {
            duration: DashboardComponent.REFLOW_DURATION_MS,
            easing: DashboardComponent.REFLOW_EASING,
          },
        );
      }
    });
  }
}
