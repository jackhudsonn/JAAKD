# JAAKD Frontend Audit Report

## Executive Stakeholder Summary (One Page)

Date: 2026-09-30
System: Angular frontend
Assessment horizon: 5+ year maintainability with multi-developer ownership

### Overall Assessment

The frontend has a strong foundation (standalone components, lazy routing, signal usage), but it is entering a high-risk maintenance phase due to concentrated complexity in a few oversized components and repeated business/form logic.

Current scores:

1. Architecture: 5.2/10
2. Readability: 5.8/10
3. DRY: 4.9/10
4. Modularity: 5.1/10
5. Maintainability: 5.0/10

### Business-Critical Risks

1. Release risk: Production build is currently broken by missing production environment file.
2. Security/access risk: Update-password route is not protected by the auth guard.
3. Reliability risk: Token refresh behavior does not consistently cover all protected auth flows.
4. Delivery risk: Core feature components (Trade, Profile, Dashboard overlays) are too large and tightly coupled, slowing changes and increasing regression probability.

### Highest-ROI Actions

1. Stabilize release and auth correctness immediately:
Fix production environment configuration, protect update-password route, and align interceptor refresh policy for password-change requests.
2. Remove repeated logic hot spots:
Centralize error mapping, location cascade handling, and password-field behavior.
3. Reduce hidden complexity:
Split oversized components into container + presentational components + domain facades.
4. Improve safety net:
Add targeted tests for auth flows, profile save/validation, and trade order lifecycle.

### Expected Outcomes After Refactor Program

1. Faster feature delivery due to smaller, clearer component boundaries.
2. Lower defect rate by eliminating duplicated logic paths.
3. Better onboarding and maintainability for additional engineers.
4. Reliable production build and safer authentication flows.

### Recommended Delivery Plan

Phase 1 (Day 1):
Fix production build path, route guard placement, and refresh policy mismatch.

Phase 2 (Week 1):
Extract shared form/error primitives and clean high-duplication code.

Phase 3 (Weeks 2-3):
Decompose Trade/Profile/Dashboard overlays using facades and subcomponents.

Phase 4 (Week 4):
Add high-value automated tests and define coding guardrails for future contributions.

### Success Metrics

1. Production build green in CI.
2. 0 unauthenticated access paths to account-security routes.
3. Reduction in duplicate logic patterns across forms and watchlist UIs.
4. New test coverage in auth, profile, and trade critical paths.
5. Component size and responsibility reduction in identified hotspots.

---

## Appendix A: Full Technical Audit (Detailed)

### JAAKD Frontend Comprehensive Audit

Date: 2026-09-30
Auditor Role: Principal Frontend Architect
Scope: Entire Angular frontend under src/

## Audit Scope And Evidence

Reviewed all relevant code in:

- Components (feature, shared, layout, app root)
- Services, guard, interceptor
- Models/interfaces
- Utilities
- Routing and app config
- Environment configuration
- Forms and templates
- Styling structure
- Tests

Validation checks performed:

1. `npx ng build --configuration local` succeeded.
2. `npx ng build --configuration production` failed because `src/environments/environment.production.ts` is missing while referenced in `angular.json` file replacements.
3. `npx ng test --watch=false` passed with only 1 test file and 1 test total.

---

## Top 25 Findings (Ranked by ROI)

### 1) Production build is broken by missing production environment file

## Finding
Production build references a non-existent environment file.

## Severity
Critical

## Location
- frontend/angular.json (production fileReplacements)
- Missing: src/environments/environment.production.ts

## Why it matters
Release builds cannot run successfully, blocking CI/CD and deployment.

## Recommended Refactor
Add `environment.production.ts` and keep replacement mapping valid.

## Example Implementation
Before:
```json
"fileReplacements": [
	{
		"replace": "src/environments/environment.local.ts",
		"with": "src/environments/environment.production.ts"
	}
]
```

After:
```ts
// src/environments/environment.production.ts
export const environment = {
	production: true,
	apiUrl: 'https://api.example.com',
	authUrl: 'https://auth.example.com',
};
```

## Effort
Small

## Expected Benefit
Unblocks production build and release pipeline immediately.

---

### 2) Update-password route is not guarded

## Finding
Sensitive account action route exists under auth shell without route protection.

## Severity
Critical

## Location
- frontend/src/app/app.routes.ts (`auth/update-password`)

## Why it matters
Security-sensitive action should only be reachable by authenticated users.

## Recommended Refactor
Move route under guarded shell or apply `canActivate` to route.

## Example Implementation
Before:
```ts
{
	path: 'auth',
	children: [{ path: 'update-password', ... }]
}
```

After:
```ts
{
	path: '',
	canActivate: [authGuard],
	children: [{ path: 'update-password', ... }]
}
```

## Effort
Small

## Expected Benefit
Corrects access control for account-security flows.

---

### 3) Refresh retry policy excludes change-password endpoint

## Finding
Interceptor refresh retry only applies to backend API URLs, not auth change-password.

## Severity
High

## Location
- frontend/src/app/core/interceptors/auth.interceptor.ts

## Why it matters
Users with expired access tokens can be logged out instead of transparently refreshed.

## Recommended Refactor
Include change-password URL in refresh-eligible requests.

## Example Implementation
Before:
```ts
function shouldAttemptRefresh(request: HttpRequest<unknown>): boolean {
	return request.url.startsWith(environment.apiUrl)
		&& !request.headers.has('x-jaakd-retried');
}
```

After:
```ts
function shouldAttemptRefresh(request: HttpRequest<unknown>): boolean {
	const isApi = request.url.startsWith(environment.apiUrl);
	const isAuthPassword = request.url.startsWith(`${environment.authUrl}/auth/change-password`);
	return (isApi || isAuthPassword) && !request.headers.has('x-jaakd-retried');
}
```

## Effort
Small

## Expected Benefit
More reliable auth UX and fewer forced logouts.

---

### 4) Environment imports are hard-coupled to environment.local

## Finding
Core services and interceptor import `@environments/environment.local` directly.

## Severity
High

## Location
- frontend/src/app/core/services/auth.service.ts
- frontend/src/app/core/services/profile.service.ts
- frontend/src/app/core/interceptors/auth.interceptor.ts

## Why it matters
Increases configuration fragility and makes environment replacement less explicit.

## Recommended Refactor
Use a single canonical environment import path (e.g., `@environments/environment`) and replace via build config.

## Example Implementation
Before:
```ts
import { environment } from '@environments/environment.local';
```

After:
```ts
import { environment } from '@environments/environment';
```

## Effort
Medium

## Expected Benefit
Cleaner configuration strategy and fewer deployment mistakes.

---

### 5) Error mapping logic is duplicated across auth and profile flows

## Finding
`mapErrorToMessage` repeated in multiple components.

## Severity
High

## Location
- frontend/src/app/features/auth/login/login.component.ts
- frontend/src/app/features/auth/register/register.component.ts
- frontend/src/app/features/auth/update-password/update-password.component.ts
- frontend/src/app/features/profile/profile.component.ts

## Why it matters
DRY violation and high risk of diverging behavior over time.

## Recommended Refactor
Extract centralized error message mapper service.

## Example Implementation
Before:
```ts
private mapErrorToMessage(error: unknown): string { ... }
```

After:
```ts
this.message.set(this.errorMessageService.toUserMessage(error, 'auth'));
```

## Effort
Small

## Expected Benefit
Consistent error UX and easier maintenance.

---

### 6) Country/state/city cascade logic duplicated in register and profile

## Finding
Location-dependent form orchestration duplicated.

## Severity
High

## Location
- frontend/src/app/features/auth/register/register.component.ts
- frontend/src/app/features/profile/profile.component.ts

## Why it matters
Complex async form dependencies are harder to evolve when duplicated.

## Recommended Refactor
Extract `LocationFormFacadeService` for all location cascade behavior.

## Example Implementation
Before:
```ts
this.states = await this.locationDataService.getStates(this.countryCode);
this.state = '';
this.city = '';
this.cities = [];
```

After:
```ts
const next = await this.locationFormFacade.onCountryChange(this.countryCode, this.countries);
Object.assign(this, next);
```

## Effort
Medium

## Expected Benefit
Better modularity and less regression risk.

---

### 7) Async side effects are triggered in constructors

## Finding
`void this.loadCountries()` is called in constructors.

## Severity
Medium

## Location
- frontend/src/app/features/auth/register/register.component.ts
- frontend/src/app/features/profile/profile.component.ts

## Why it matters
Constructors should not trigger async behavior; harder lifecycle/test control.

## Recommended Refactor
Move initialization into `ngOnInit`.

## Example Implementation
Before:
```ts
constructor(...) {
	void this.loadCountries();
}
```

After:
```ts
async ngOnInit() {
	await this.loadCountries();
	await this.loadProfile();
}
```

## Effort
Small

## Expected Benefit
Predictable component lifecycle.

---

### 8) Register flow has nested multi-branch orchestration in one method

## Finding
`signUp()` has register/login/profile fetch/profile create logic with nested try/catch.

## Severity
High

## Location
- frontend/src/app/features/auth/register/register.component.ts

## Why it matters
Difficult to reason about edge cases and maintain over time.

## Recommended Refactor
Move flow into `RegistrationFlowService` returning explicit states.

## Example Implementation
Before:
```ts
async signUp() {
	// register -> login -> get profile -> maybe create profile
}
```

After:
```ts
const result = await this.registrationFlow.execute(payload);
if (result.redirectTo) await this.router.navigate([result.redirectTo]);
```

## Effort
Medium

## Expected Benefit
Cleaner flow logic and easier testing.

---

### 9) ProfileComponent carries too many responsibilities

## Finding
Single component handles data loading, editing, validation, location dependencies, and persistence.

## Severity
High

## Location
- frontend/src/app/features/profile/profile.component.ts
- frontend/src/app/features/profile/profile.component.html

## Why it matters
Large component (220 TS lines, 200 template lines) raises cognitive load and coupling.

## Recommended Refactor
Split into container + form component + profile facade.

## Example Implementation
Before:
```ts
export class ProfileComponent { /* load, edit, validate, save */ }
```

After:
```ts
export class ProfilePageComponent { /* orchestration only */ }
export class ProfileFormComponent { /* form rendering + events */ }
```

## Effort
Large

## Expected Benefit
Improved readability, modularity, and testability.

---

### 10) TradeComponent is overloaded with domain logic

## Finding
Component handles order lifecycle simulation, holdings/cash mutation, watchlists, deep links, and popup states.

## Severity
High

## Location
- frontend/src/app/features/trade/trade.component.ts

## Why it matters
291-line component with multiple bounded contexts is hard to evolve.

## Recommended Refactor
Extract `TradeFacadeService`, `OrdersService`, and `WatchlistService`.

## Example Implementation
Before:
```ts
private processOrders() { ... }
private fillOrder(...) { ... }
setWatchlistMembership(...) { ... }
```

After:
```ts
this.tradeFacade.placeOrder(request);
this.tradeFacade.setWatchlistMembership(request);
```

## Effort
Large

## Expected Benefit
Cleaner boundaries and backend-migration readiness.

---

### 11) Dashboard overlays component is a mega-controller

## Finding
One class handles watchlist CRUD, search, modal lifecycle, and cross-feature routing.

## Severity
High

## Location
- frontend/src/app/features/dashboard/components/overlays/dashboard-overlays.component.ts
- frontend/src/app/features/dashboard/components/overlays/dashboard-overlays.component.html

## Why it matters
405-line TypeScript class is beyond maintainable complexity threshold.

## Recommended Refactor
Split into domain-specific subcomponents/facades:
- watchlist editor
- watchlist search modal
- allocation asset modal

## Example Implementation
Before:
```ts
requestCreateWatchlist();
saveWatchlistName();
addSymbolToActiveWatchlist();
openTradeForAllocationAsset();
```

After:
```ts
watchlistDialogFacade.openCreate();
watchlistSearchFacade.addSymbol(symbol);
allocationModalFacade.open(asset);
```

## Effort
Large

## Expected Benefit
Reduced hidden complexity and improved reusability.

---

### 12) Deposit and withdrawal forms duplicate logic and markup

## Finding
Separate components differ mostly by button text/type.

## Severity
High

## Location
- frontend/src/app/features/transact/deposit-form/deposit-form.component.ts
- frontend/src/app/features/transact/withdrawal-form/withdrawal-form.component.ts
- Corresponding HTML templates

## Why it matters
Any fix must be repeated and can diverge behavior.

## Recommended Refactor
Create one parameterized `TransactionFormComponent`.

## Example Implementation
Before:
```ts
submit() { if (!this.amount || this.amount <= 0) ... }
```

After:
```ts
<app-transaction-form type="deposit" (submitted)="onDeposit($event)" />
<app-transaction-form type="withdrawal" (submitted)="onWithdrawal($event)" />
```

## Effort
Medium

## Expected Benefit
High DRY improvement and lower maintenance cost.

---

### 13) Password visibility behavior is duplicated and partly coupled

## Finding
Password toggle logic appears in login/register/update-password. In update-password, current/new fields share one visibility flag.

## Severity
Medium

## Location
- frontend/src/app/features/auth/login/login.component.ts
- frontend/src/app/features/auth/register/register.component.ts
- frontend/src/app/features/auth/update-password/update-password.component.ts
- frontend/src/app/features/auth/update-password/update-password.component.html

## Why it matters
Inconsistent UX and repeated low-level behavior.

## Recommended Refactor
Extract `PasswordFieldComponent` with independent visibility state.

## Example Implementation
Before:
```ts
showPassword = false;
togglePasswordVisibility() { ... }
```

After:
```html
<app-password-field [(value)]="password" label="Password" />
```

## Effort
Medium

## Expected Benefit
Consistent auth form UX and cleaner auth components.

---

### 14) Features are tightly coupled to global mock singleton state

## Finding
Multiple features directly import and mutate `MOCK_STATE`.

## Severity
High

## Location
- frontend/src/app/features/trade/trade.component.ts
- frontend/src/app/features/dashboard/widgets/watchlist/watchlist.component.ts
- frontend/src/app/features/dashboard/widgets/open-orders/open-orders.component.ts
- frontend/src/app/features/transact/transact.component.ts

## Why it matters
Coupling blocks scalable migration to real API-driven state management.

## Recommended Refactor
Introduce facades/adapters per domain and isolate mock implementation behind interfaces.

## Example Implementation
Before:
```ts
transactions = MOCK_STATE.transactions;
```

After:
```ts
transactions = this.transactionsFacade.transactions;
```

## Effort
Large

## Expected Benefit
Scalable architecture and cleaner test seams.

---

### 15) Sorting logic is duplicated across multiple components

## Finding
Sort key/direction and date compare logic repeated.

## Severity
Medium

## Location
- frontend/src/app/features/transact/transaction-history/transaction-history.component.ts
- frontend/src/app/features/trade/cards/orders-card/orders-card.component.ts
- frontend/src/app/features/dashboard/widgets/open-orders/open-orders.component.ts

## Why it matters
Sort behavior can drift and bug fixes duplicate effort.

## Recommended Refactor
Extract comparator helpers for date/string/number sorts.

## Example Implementation
Before:
```ts
new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
```

After:
```ts
compareByDate(a.createdAt, b.createdAt, direction)
```

## Effort
Small

## Expected Benefit
More consistent sorting and lower code duplication.

---

### 16) Watchlist row templates are duplicated

## Finding
Very similar row/action markup appears in dashboard watchlist widget and trade watchlist card.

## Severity
Medium

## Location
- frontend/src/app/features/dashboard/widgets/watchlist/watchlist.component.html
- frontend/src/app/features/trade/cards/watchlist-card/watchlist-card.component.html

## Why it matters
UI consistency drift and duplicated styling work.

## Recommended Refactor
Extract shared watchlist list component and project per-context actions.

## Example Implementation
Before:
```html
<button class="listing-row">...</button>
```

After:
```html
<app-watchlist-list [rows]="rows" (rowSelected)="..." />
```

## Effort
Medium

## Expected Benefit
DRY templates and consistent behavior.

---

### 17) Navbar links are hardcoded three times

## Finding
Desktop nav, dropdown nav, and mobile nav duplicate same route links.

## Severity
Medium

## Location
- frontend/src/app/shared/components/navbar/navbar.component.html

## Why it matters
Route/menu updates require edits in multiple places.

## Recommended Refactor
Use one link config array rendered by `@for` in each section.

## Example Implementation
Before:
```html
<a routerLink="/dashboard">Dashboard</a>
... repeated ...
```

After:
```ts
links = [{ path: '/dashboard', label: 'Dashboard' }, ...];
```

## Effort
Small

## Expected Benefit
Higher maintainability and fewer nav regressions.

---

### 18) Profile template uses repeated complex fallback expression

## Finding
Display name/email/initial fallback chain repeated in template.

## Severity
Medium

## Location
- frontend/src/app/features/profile/profile.component.html

## Why it matters
Template readability suffers and future fallback changes are error-prone.

## Recommended Refactor
Move fallback logic to computed signals in component.

## Example Implementation
Before:
```html
{{ displayName() || profile()?.email || authService.userEmail() || '—' }}
```

After:
```ts
readonly identityLabel = computed(() => ...);
```

## Effort
Small

## Expected Benefit
Cleaner templates and easier testing.

---

### 19) Unsafe type assertions for backend error payload

## Finding
`error.error as Partial<ErrorResponse>` used without runtime guard.

## Severity
Medium

## Location
- login/register/update-password/profile components

## Why it matters
Can produce incorrect message behavior when API response shape differs.

## Recommended Refactor
Add robust type guard before reading fields.

## Example Implementation
Before:
```ts
const response = error.error as Partial<ErrorResponse> | undefined;
```

After:
```ts
const response = isErrorResponse(error.error) ? error.error : undefined;
```

## Effort
Small

## Expected Benefit
Better type safety and fewer runtime surprises.

---

### 20) Event target casting pattern is repeated and weakly typed

## Finding
Frequent `event.target as HTMLSelectElement` casts in handlers.

## Severity
Medium

## Location
- frontend/src/app/features/transact/transaction-history/transaction-history.component.ts
- frontend/src/app/features/dashboard/widgets/watchlist/watchlist.component.ts
- frontend/src/app/features/trade/cards/watchlist-card/watchlist-card.component.ts

## Why it matters
Verbose, brittle DOM coupling; reduces type quality.

## Recommended Refactor
Prefer typed values from `ngModelChange`.

## Example Implementation
Before:
```ts
onTypeFilterChange(event: Event) {
	this.typeFilter.set((event.target as HTMLSelectElement).value as TransactionType | 'all');
}
```

After:
```html
(ngModelChange)="onTypeFilterChange($event)"
```
```ts
onTypeFilterChange(value: TransactionType | 'all') { this.typeFilter.set(value); }
```

## Effort
Small

## Expected Benefit
Cleaner handlers and stronger typing.

---

### 21) Shared ScrollableList uses weak generic trackBy contract

## Finding
`trackBy` input returns `unknown`.

## Severity
Medium

## Location
- frontend/src/app/shared/components/scrollable-list/scrollable-list.component.ts

## Why it matters
Weak identity typing in a shared primitive affects many consumers.

## Recommended Refactor
Use `PropertyKey` instead of `unknown`.

## Example Implementation
Before:
```ts
trackBy = input<(item: T) => unknown>((item) => item);
```

After:
```ts
trackBy = input<(item: T) => PropertyKey>((item) => String(item));
```

## Effort
Small

## Expected Benefit
Safer reusable API.

---

### 22) Shared LineChart uses `any` in tooltip callback

## Finding
Tooltip callback context is typed as `any`.

## Severity
Medium

## Location
- frontend/src/app/shared/components/line-chart/line-chart.component.ts

## Why it matters
`any` in shared component weakens type guarantees globally.

## Recommended Refactor
Use Chart.js tooltip context types.

## Example Implementation
Before:
```ts
label: (context: any) => { ... }
```

After:
```ts
label: (context: TooltipItem<'line'>) => { ... }
```

## Effort
Small

## Expected Benefit
Better compiler support and safer refactors.

---

### 23) Location data service repeats state lookup in city lookup flow

## Finding
`getCities()` re-fetches or re-derives states already retrieved by `getStates()`.

## Severity
Medium

## Location
- frontend/src/app/core/services/location-data.service.ts

## Why it matters
Unnecessary repeated logic and extra async work.

## Recommended Refactor
Introduce memoization/cache map by country code.

## Example Implementation
Before:
```ts
const states = await getStatesOfCountry(countryCode);
```

After:
```ts
const states = await this.getStatesCached(countryCode);
```

## Effort
Medium

## Expected Benefit
Lower complexity and better performance where it matters architecturally.

---

### 24) No timeout policy for API calls

## Finding
All service calls use `firstValueFrom` without timeout/error policy.

## Severity
Medium

## Location
- frontend/src/app/core/services/auth.service.ts
- frontend/src/app/core/services/profile.service.ts

## Why it matters
Hung requests can trap UI states and complicate reliability.

## Recommended Refactor
Apply timeout and error normalization in shared request helper.

## Example Implementation
Before:
```ts
firstValueFrom(this.httpClient.get(...))
```

After:
```ts
firstValueFrom(this.httpClient.get(...).pipe(timeout(10000), catchError(...)))
```

## Effort
Small

## Expected Benefit
Predictable failure behavior and simpler retry UX.

---

### 25) Test coverage is critically low

## Finding
Only root app creation test exists.

## Severity
High

## Location
- frontend/src/app/app.spec.ts
- No specs for auth/profile/trade/transact/services/utilities/shared components

## Why it matters
High regression risk in complex business flows.

## Recommended Refactor
Add tests for high-risk areas first (auth service/interceptor, register flow, profile validation, trade order lifecycle).

## Example Implementation
Before:
```ts
it('should create the app', ...)
```

After:
```ts
describe('AuthService refresh flow', ...)
describe('RegisterComponent conflict + login fallback', ...)
describe('Trade order fill lifecycle', ...)
```

## Effort
Large

## Expected Benefit
Safer long-term maintenance and refactoring velocity.

---

## Duplicate Logic Inventory

1. Error mapping duplicated across login/register/update-password/profile.
2. Country/state/city cascade duplicated in register/profile.
3. Password visibility toggle duplicated in login/register/update-password.
4. Deposit/withdraw amount validation duplicated.
5. Watchlist row and pricing markup duplicated between dashboard and trade watchlist views.
6. Sort state/comparator logic duplicated in transaction and order lists.
7. Snake-case-to-label formatting duplicated (`formatLabel` utility + local formatter).
8. Navbar route links duplicated in desktop/more/mobile sections.

---

## Component Responsibilities Review

Overloaded components:

1. `ProfileComponent`: data loading, form state, validation, location cascade, persistence.
2. `TradeComponent`: order engine simulation, account mutation, watchlist mutation, deep links, popup orchestration.
3. `DashboardOverlaysComponent`: multiple modal domains + watchlist management + navigation integration.
4. `ShellComponent`: layout responsibilities mixed with profile fetch and ticker formatting.

Recommended decomposition:

1. Container components for orchestration.
2. Presentational subcomponents for rendering.
3. Domain facades/services for workflow/business logic.

---

## Service Design Review

1. `AuthService` combines transport + token storage + JWT parsing.
2. `ProfileService` lacks standardized timeout/retry/error policy.
3. `LocationDataService` should memoize lookups.
4. `MarketTickerService` is static and non-reactive.

Recommended service boundaries:

1. `TokenStorageService`
2. `JwtService`
3. `ErrorMessageService`
4. `RegistrationFlowService`
5. `ProfileFacadeService`
6. `TradeFacadeService`
7. `LocationFormFacadeService`

---

## Shared Functionality To Centralize

1. Error message mapping.
2. Location-form cascade behavior.
3. Password input behavior and accessibility.
4. Generic transaction form.
5. Sorting/comparator helper utilities.
6. Data-driven navbar link model.
7. Watchlist list-row presentation.
8. API request policy wrapper (timeout, error normalization).

---

## Angular Architecture Review

### Standalone component usage
Strong and consistent.

### Dependency injection patterns
Mostly good; mixed injection styles and constructor-triggered async work should be standardized.

### Routing structure
Lazy loading is good; sensitive route guard placement needs correction.

### Signal usage
Widely used and appropriate, but uneven in forms (plain mutable fields still dominate in complex forms).

### RxJS usage
Minimal. Service resilience operators (timeout/retry/backoff) are missing.

### Change detection strategy
App uses zoneless configuration; architecture still suffers from oversized orchestration components that should be decomposed for maintainability.

### State management approach
Current approach is mock-global singleton driven; move to domain facades and adapters to scale.

---

## Folder Structure Review

Current top-level organization is generally feature-based and sound.

Recommended structural improvements:

1. Add `core/facades` for workflow orchestration.
2. Add `shared/forms` for reusable field/form primitives.
3. Split `core/mocks/mock-data.ts` into domain-specific files.
4. Keep transport services in `core/services`; move flow logic out of components.
5. Co-locate tests with their components/services.

---

## TypeScript Review

Issues identified:

1. `any` in shared chart callback.
2. Repeated unsafe response casting for error payloads.
3. Weak generic identity contract in shared list.
4. Repeated event-target casts.
5. String literal category narrowing better represented by typed guard map.

---

## Template Review

1. Profile and overlay templates are large and multi-concern.
2. Repeated auth status message markup.
3. Repeated watchlist/listing row markup.
4. Complex fallback expressions should be moved to computed values.
5. Ensure live-region semantics for user-visible async status/errors.

---

## Technical Debt Priority (Top 25 by ROI)

1. Fix production environment build break.
2. Guard update-password route.
3. Extend refresh retry policy to password endpoint.
4. Decouple from direct environment.local imports.
5. Centralize error mapping.
6. Extract location cascade facade.
7. Remove constructor-triggered async loads.
8. Refactor register orchestration flow.
9. Split profile component responsibilities.
10. Split trade component responsibilities.
11. Split dashboard overlays responsibilities.
12. Merge deposit/withdraw forms into generic component.
13. Extract password field component.
14. Replace direct global mock coupling with facades.
15. Centralize sorting logic.
16. Extract shared watchlist list-row presentation.
17. DRY navbar links.
18. Move profile fallback logic into computed values.
19. Add runtime guards for error payloads.
20. Replace event target casts with typed value handlers.
21. Strengthen generic typing in shared list.
22. Remove `any` from chart callback.
23. Add location data caching.
24. Add request timeout policy.
25. Build test coverage in critical flows.

---

## Refactoring Roadmap

### 1) Quick wins (< 1 hour)

1. Add `environment.production.ts`.
2. Protect update-password route.
3. Adjust interceptor refresh policy for change-password.
4. Reuse `formatLabel` in open-orders widget.
5. Add `role="alert"` / `aria-live` to auth and profile status messages.

### 2) Small improvements (< 1 day)

1. Extract centralized error message mapper.
2. Move constructor async calls to `ngOnInit`.
3. Replace DOM target casting handlers with typed `ngModelChange` flows.
4. Tighten `ScrollableList` trackBy typing and remove `any` from charts.
5. Replace duplicated navbar links with data-driven rendering.

### 3) Medium projects (< 1 week)

1. Build `LocationFormFacadeService` used by register/profile.
2. Implement generic transaction form and remove duplicate components.
3. Introduce auth/profile/shell facades for workflow logic.
4. Extract shared watchlist list-row component.
5. Create shared API request policy helper (timeout + errors).

### 4) Large architectural improvements

1. Decompose `TradeComponent` into container + domain services.
2. Decompose `ProfileComponent` into container + form + facade.
3. Decompose `DashboardOverlaysComponent` by modal domain.
4. Replace global mock singleton coupling with domain adapter pattern.
5. Establish full frontend test strategy (unit + integration + interceptor tests).

---

## Scores

1. Architecture score: 5.2 / 10
2. Readability score: 5.8 / 10
3. DRY score: 4.9 / 10
4. Modularity score: 5.1 / 10
5. Maintainability score: 5.0 / 10

---

## Executive Summary

The frontend has a strong modern Angular baseline (standalone components, lazy routing, signal usage), but long-term maintainability is currently constrained by oversized orchestration components, duplicated form/error logic, and direct coupling to global mock state.

Most impactful next steps:

1. Fix release correctness first (production environment file, route guard placement, refresh policy).
2. Extract shared primitives for error handling, location cascade, and password fields to remove duplication.
3. Introduce domain facades and split overloaded components (Profile, Trade, DashboardOverlays).
4. Tighten type safety (`any`, unsafe assertions, cast-heavy handlers).
5. Build foundational tests around auth/profile/trade critical paths before major refactors.

This path yields the highest ROI for a codebase expected to be maintained by multiple developers for 5+ years.
