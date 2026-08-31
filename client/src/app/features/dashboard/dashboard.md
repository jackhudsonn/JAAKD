# Dashboard Feature

A customisable widget grid that lets users choose which data panels appear on their home screen.

---

## Directory Structure

```
dashboard/
├── dashboard.component.{ts,html,css}   # Host component — manages the widget grid
├── dashboard-widget.model.ts           # WidgetId type, WidgetDefinition interface, WIDGET_CATALOGUE
├── mock-data.ts                        # All mock data used by widgets (replace with real services)
│
├── widget-card/                        # Presentational chrome shared by every widget
│   └── widget-card.component.{ts,html,css}
│
├── widget-selector/                    # "Edit widgets" drop-down (toggle/reorder picker)
│   └── widget-selector.component.{ts,html,css}
│
└── widgets/                            # One subfolder per widget
    ├── allocation-by-asset/
    ├── open-orders/
    ├── performance-graph/
    ├── portfolio-value/
    ├── top-movers/
    └── watchlist/
```

---

## How Widgets Work

1. **Model** — every widget has a `WidgetId` string literal in `dashboard-widget.model.ts` and a `WidgetDefinition` entry in `WIDGET_CATALOGUE`. The catalogue drives both the selector UI and the default set shown on first load (`defaultEnabled`).

2. **Rendering** — `DashboardComponent` holds a `selectedWidgets` signal (the logical selection) and a `displayWidgets` signal (what the grid actually renders). The two are kept in sync with a short delay on removal so exit animations play before the DOM slot is removed.

3. **Widget card chrome** — every widget wraps its content in `<app-widget-card [title]="..." [subtitle]="...">`. This keeps visual consistency without duplicating markup.

4. **Constraints** — `MIN_SELECTED_WIDGETS` and `MAX_SELECTED_WIDGETS` are defined in the model file. The selector disables checkboxes at these limits.

---

## Adding a New Widget

1. **Create the component**

   ```
   widgets/my-widget/
     my-widget.component.ts
     my-widget.component.html
     my-widget.component.css
   ```

   Wrap content with `<app-widget-card>` and import `WidgetCardComponent`.

2. **Register the widget ID**

   In `dashboard-widget.model.ts`:
   - Add a new string literal to the `WidgetId` union type.
   - Add an entry to `WIDGET_CATALOGUE` with `defaultEnabled` set as appropriate.
   - Bump `MAX_SELECTED_WIDGETS` if the constant is used as a hard cap.

3. **Wire it into the dashboard**

   In `dashboard.component.ts`:
   - Import the new component class.
   - Add it to the `imports` array.
   - Add a branch in the template (`dashboard.component.html`) that renders it when its `WidgetId` is in `displayWidgets`.

That's it — the selector, toggle logic, and enter/leave animations are inherited automatically.

---

## Mock Data

All placeholder data lives in `mock-data.ts`. Each export is annotated with a `TODO` comment naming the real service/endpoint it should eventually call. When a real service is ready:

1. Inject it into the widget component's constructor.
2. Replace the mock import with a signal or observable from the service.
3. Remove the corresponding export from `mock-data.ts` once nothing references it.

---

## TODOs

### Persistence
Widget selection and order currently reset on every page load. The `selectedWidgets` signal should be persisted — either to `localStorage` for a quick win, or to a user-preferences endpoint so the layout roams across devices and sessions.

### Real Data
Each widget in `mock-data.ts` is tagged with which service should back it:

| Widget | Needed service/feed |
|---|---|
| Portfolio Value & Returns | Account balance + real-time position valuation |
| Open Orders | Orders service (REST polling or WebSocket) |
| Watchlist | Market data service / Kafka feed |
| Top Movers | Market data service / Kafka feed |
| Allocation by Asset | Portfolio positions endpoint |
| Performance Graph | Performance / analytics endpoint (P&L over time) |

### Responsive Grid
The grid layout is CSS-driven. Consider defining breakpoint-aware column counts so the layout degrades gracefully on tablet and mobile viewports.

### Testing
- **Unit tests** for `DashboardComponent`: cover `onToggleWidget` (add, remove, min/max guard), `isEntering`/`isLeaving` state, and the exit-animation delay.
- **Unit tests** for `WidgetSelectorComponent`: cover `isDisabled` at the min and max boundaries.
- **Component tests** for each widget: verify it renders without errors when given mock input and that `WidgetCardComponent` receives the correct `title`/`subtitle` values.
- **E2E tests**: open the selector, toggle a widget off and on, and assert the grid updates correctly.

### Widget Configuration
Future widgets (e.g. a chart with a configurable time range) may need per-widget settings. The `WidgetDefinition` interface in the model file can be extended with an optional `config` field; the persistence layer would store config alongside selection state.
