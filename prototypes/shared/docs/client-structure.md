# JAAKD Client — Angular Directory Structure

> Last updated: 2026-08-28  
> Stack: Angular (standalone, zoneless), Supabase Auth, Spring Boot API (planned), Kafka (planned)

---

## Directory Tree

```
client/src/
├── app/
│   ├── core/                        # Singleton, app-wide concerns
│   │   ├── guards/
│   │   │   └── auth.guard.ts        # Redirects unauthenticated users to /auth/login
│   │   ├── interceptors/            # HTTP interceptors (e.g. auth token injection) — placeholder
│   │   ├── models/
│   │   │   └── index.ts             # Shared domain interfaces: Trades, Position, MarketQuote
│   │   └── services/
│   │       └── supabase.service.ts  # Supabase client wrapper (auth, session)
│   │
│   ├── features/                    # Self-contained feature areas (lazy-loaded)
│   │   ├── auth/
│   │   │   ├── login/               # Login page — full-page layout, no shell
│   │   │   └── register/            # Register page — stub, same layout as login
│   │   ├── dashboard/
│   │   ├── transact/
│   │   └── trade/
│   │
│   ├── layout/
│   │   └── shell/                   # Authenticated app shell: top nav + <router-outlet>
│   │                                # Loaded as the parent route for all protected pages
│   │
│   ├── shared/                      # Reusable, dumb/presentational pieces
│   │   ├── components/
│   │   │   ├── navbar/              # Placeholder — extract nav from ShellComponent when ready
│   │   │   └── sidebar/             # Placeholder — for a collapsible sidebar if needed
│   │   ├── directives/              # Custom attribute/structural directives
│   │   └── pipes/                   # Custom display pipes (e.g. currency formatting)
│   │
│   ├── app.ts                       # Root AppComponent — bare <router-outlet> host
│   ├── app.html
│   ├── app.css
│   ├── app.config.ts                # Angular application providers
│   └── app.routes.ts                # Top-level route tree
│
├── environments/
│   └── environment.ts               # Supabase URL + anon key
│
└── styles/                          # Global design tokens and utility CSS
    ├── tokens.css                   # CSS custom properties (colour, spacing, type)
    ├── buttons.css
    ├── forms.css
    └── layout.css                   # Shared structural classes (.app-header, .app-nav, etc.)
```

---

## Routing Architecture

```
/auth/login       →  LoginComponent        (no guard, full-page layout)
/auth/register    →  RegisterComponent     (no guard, stub)

/ (ShellComponent, canActivate: authGuard)
  /dashboard      →  DashboardComponent    (lazy)
  /transact   →  TransactComponent (lazy)
  /trade          →  TradeComponent    (lazy)

**            →  redirects to /
```

The `authGuard` checks the active Supabase session. Unauthenticated requests are redirected to `/auth/login` via Angular's `UrlTree` pattern (no RxJS required).

---

## Conventions

| Layer | Rule |
|---|---|
| **core/** | Provided in root (`providedIn: 'root'`). No feature-specific logic. |
| **features/** | One folder per route. Each component is standalone. Lazy-loaded via `loadComponent`. |
| **layout/** | One shell for authenticated pages. Extract into `shared/components/` if a second layout is needed. |
| **shared/** | Presentational only — no service calls or routing. Import into whichever feature needs them. |
| **File naming** | `*.component.ts`, `*.service.ts`, `*.guard.ts`, `*.pipe.ts`, `*.directive.ts` |
| **Signals** | Use Angular signals (`signal()`, `computed()`) over RxJS for local component state. |

---

## Planned Additions

- **`core/services/api.service.ts`** — HTTP client wrapper for the Spring Boot REST API
- **`core/interceptors/auth-token.interceptor.ts`** — Attach Supabase JWT to outgoing API requests
- **`core/services/market.service.ts`** — Real-time market data via Kafka WebSocket bridge
- **`shared/components/navbar/`** — Extract nav from `ShellComponent` once it grows
- **`features/auth/register/`** — Full registration form once backend user provisioning is ready
