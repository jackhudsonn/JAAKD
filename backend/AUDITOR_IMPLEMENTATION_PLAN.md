# Auditor Search and Instrument RBAC Implementation Plan

## Objectives

1. Keep instrument read endpoints available to all authenticated users.
2. Restrict instrument write operations (create, update) to admin only.
3. Add auditor-capable cross-user search.
4. Add auditor-capable order-log filtering by day (date-only semantics).
5. Add auditor-capable order-log filtering by ticker/instrument type.
6. Add auditor drilldown reads for portfolios, holdings, position lots, and lot matches.
7. Add user-capable instrument filtering by instrument type or ticker search.
8. Use clean, simple code writing practices.

## Final Policy Decisions

1. Instrument reads are authenticated-only (not public).
2. Instrument writes are admin-only.
3. Auditor endpoints are accessible to admin and auditor roles.
4. User ownership-scoped endpoints remain available to `RETAIL_CLIENT` (and admin where applicable).
5. Date filtering is day-level only and does not support time-of-day precision.
6. User-facing instrument list/search supports optional ticker text search and instrument-type filtering.

## Delivery Phases

### Phase 1: RBAC Baseline and Contracts

1. Confirm endpoint contracts and query parameters for instrument filtering, audit search, and audit drilldowns.
2. Confirm role boundaries:
   - `RETAIL_CLIENT`: ownership-scoped user endpoints + instrument reads/filtering.
   - `AUDITOR`: cross-user audit reads.
   - `ADMIN`: cross-user audit reads + instrument writes.
3. Confirm pagination defaults and maximum page size for all new list endpoints.

**Phase 1 Exit Criteria**

1. Endpoint and query parameter contracts are frozen for implementation.
2. Role matrix is documented and approved for all affected routes.
3. Default sort keys and pagination limits are defined for every new list response.

### Phase 1 Kickoff Output (Contract Freeze v1)

Date: 2026-10-13

#### A. Endpoint Contracts (Frozen)

1. Instrument read endpoint (authenticated):
   - GET `/api/instruments?instrumentType=&query=&page=&size=`
   - `instrumentType` optional enum (`InstrumentClass`)
   - `query` optional, trimmed, case-insensitive match against ticker and name
   - `page` optional integer, default `0`, min `0`
   - `size` optional integer, default `25`, min `1`, max `100`
2. Instrument detail reads remain unchanged:
   - GET `/api/instruments/{instrumentId}`
   - GET `/api/instruments/ticker/{ticker}`
3. Instrument writes (admin-only enforcement in Phase 2):
   - POST `/api/instruments`
   - PUT `/api/instruments/{instrumentId}`
4. Auditor user search:
   - GET `/api/audit/users?query=&page=&size=`
   - `query` required, trimmed, minimum 1 non-whitespace character
5. Auditor cross-user drilldown:
   - GET `/api/audit/users/{userId}/portfolios?page=&size=`
   - GET `/api/audit/users/{userId}/holdings?portfolioId=&page=&size=`
   - GET `/api/audit/holdings/{holdingId}/position-lots?page=&size=`
   - GET `/api/audit/holdings/{holdingId}/lot-matches?page=&size=`
6. Auditor order-log filtering:
   - GET `/api/audit/order-logs?userId=&date=&status=&ticker=&instrumentType=&page=&size=`
   - `date` required and interpreted as day-only (`LocalDate`)
   - `userId`, `status`, `ticker`, `instrumentType` optional

#### B. Role Matrix (Frozen)

1. `RETAIL_CLIENT`
   - Allowed: ownership-scoped endpoints (`/api/portfolios`, `/api/holdings`, `/api/order-logs`, `/api/watchlists`, `/api/profile`)
   - Allowed: instrument reads and instrument filtering
   - Not allowed: instrument writes, all `/api/audit/**`
2. `AUDITOR`
   - Allowed: all `/api/audit/**` reads
   - Allowed: instrument reads and instrument filtering
   - Not allowed: instrument writes
3. `ADMIN`
   - Allowed: all `/api/audit/**` reads
   - Allowed: instrument reads and instrument filtering
   - Allowed: instrument writes

#### C. Pagination and Deterministic Sorting Defaults (Frozen)

1. Defaults (all new list endpoints):
   - `page=0`
   - `size=25`
   - maximum `size=100`
2. Deterministic sort keys:
   - Instrument list/filter: `ticker ASC, instrumentId ASC`
   - Audit user search: `userId ASC`
   - Audit user portfolios: `portfolioId ASC`
   - Audit user holdings: `holdingID ASC`
   - Audit position lots: `openedAt ASC, positionLotID ASC`
   - Audit lot matches: `matchedAt ASC, lotMatchID ASC`
   - Audit order logs: `timestamp DESC, logOrderID DESC`

#### D. Current-State Notes from Codebase Review

1. Global Spring security currently enforces authentication for all `/api/**` except auth endpoints.
2. `PrivilegedAccessService` currently exposes only `ensureAdminOrAuditor()`; `ensureAdmin()` will be added in Phase 2.
3. Existing repositories/controllers primarily return unpaged lists; pagination support must be added for new Phase 3-6 list routes.
4. OpenAPI currently documents `DELETE /api/instruments/{instrumentId}` but there is no matching controller method; keep out of this RBAC scope unless separately prioritized.

### Phase 2: Lock Instrument Writes to Admin and Preserve Authenticated Reads

1. Update instrument write paths to enforce admin-only checks:
   - POST `/api/instruments`
   - PUT `/api/instruments/{instrumentId}`
2. Keep instrument GET endpoints available to all authenticated users:
   - GET `/api/instruments`
   - GET `/api/instruments/{instrumentId}`
   - GET `/api/instruments/ticker/{ticker}`
3. Add or extend privileged checks in `PrivilegedAccessService`:
   - Keep `ensureAdminOrAuditor()` for audit reads.
   - Add `ensureAdmin()` for instrument writes.
4. Add tests to prove:
   - Admin can write.
   - Auditor cannot write.
   - Retail client cannot write.
   - All authenticated roles can read instruments.

**Phase 2 Exit Criteria**

1. Write endpoints reject non-admin callers with consistent authorization behavior.
2. Read endpoints remain accessible to all authenticated roles.
3. Authorization tests pass for admin, auditor, and retail-client permutations.

### Phase 3: User-Capable Instrument Filtering

1. Add optional filtering parameters to instrument list/search endpoints:
   - Example: GET `/api/instruments?instrumentType=&query=&page=&size=`
2. Support case-insensitive ticker/company search for authenticated users.
3. Support optional instrument-type filtering for authenticated users.
4. Keep existing instrument read contracts backward-compatible:
   - No required new query parameters.
   - Existing clients continue to work unchanged.
5. Add deterministic ordering when paging is used.
6. Add tests for:
   - Filter by ticker/query only.
   - Filter by instrument type only.
   - Combined filters.
   - Empty results.
   - Access allowed for all authenticated roles.

**Phase 3 Exit Criteria**

1. Authenticated users can filter instruments by ticker/query and instrument type.
2. Paging responses are deterministic under repeated calls.
3. Backward compatibility is verified for callers that do not send new query parameters.

### Phase 4: Auditor User Search

1. Add auditor endpoint for user search:
   - Example: GET `/api/audit/users?query=&page=&size=`
2. Implement case-insensitive matching across:
   - `users.email`
   - `profiles.username`
   - `profiles.firstName`
   - `profiles.lastName`
3. Add pagination and stable ordering (for deterministic paging).
4. Add request validation:
   - `query` required and trimmed.
   - page/size bounds.
5. Add response DTO with only required fields (avoid overexposure).
6. Add tests for:
   - Match behavior across each field.
   - Empty results.
   - Invalid input handling.
   - Forbidden access for non-admin/non-auditor users.

**Phase 4 Exit Criteria**

1. Auditor/admin user search returns expected matches across all target fields.
2. Search validation rejects empty/invalid requests with clear API errors.
3. Response payload excludes unnecessary PII fields.

### Phase 5: Auditor Order-Log Filtering by Day and Instrument Attributes

1. Add auditor endpoint for order-log filtering:
   - Example: GET `/api/audit/order-logs?userId=&date=&status=&ticker=&instrumentType=&page=&size=`
2. Implement day-based date semantics using boundaries:
   - `start = date.atStartOfDay()`
   - `end = date.plusDays(1).atStartOfDay()`
   - query with `timestamp >= start AND timestamp < end`
3. Keep ticker, instrument type, and status filters optional.
4. Resolve ticker/instrument-type filtering via instrument join or equivalent repository query.
5. Enforce admin-or-auditor checks on this endpoint.
6. Add tests for:
   - Includes all logs on requested day.
   - Excludes previous/next day logs.
   - Ticker filter behavior.
   - Instrument-type filter behavior.
   - Combined date + ticker/type filters.
   - Invalid or missing date handling.

**Phase 5 Exit Criteria**

1. Date filter strictly uses day boundaries (`>= start`, `< end`) and passes boundary tests.
2. Optional ticker/type/status filters compose correctly with date constraints.
3. Auditor/admin-only access is enforced for the endpoint.

### Phase 6: Auditor Drilldown Endpoints

1. Add auditor user-level reads:
   - User portfolios.
   - User holdings.
2. Add auditor holding-level reads:
   - Position lots by holding.
   - Lot matches by holding.
3. Ensure these endpoints use cross-user repository methods (not ownership-scoped methods used by retail users).
4. Enforce admin-or-auditor checks on all auditor endpoints.
5. Add tests for access control and result correctness.

**Phase 6 Exit Criteria**

1. Auditor/admin callers can retrieve cross-user drilldown data for portfolios, holdings, lots, and matches.
2. Retail ownership-scoped paths remain unchanged in behavior.
3. Drilldown endpoints pass both access-control and data-correctness tests.

### Phase 7: Documentation and Verification

1. Update API docs with:
   - New `/api/audit/*` endpoints.
   - Instrument filter query parameters for authenticated users.
   - Required query parameters.
   - Role matrix for read/write permissions.
2. Run backend tests (`mvnw test`) and fix regressions.
3. Perform manual API smoke tests for:
   - Retail user instrument read and filter access.
   - Auditor cross-user audit reads.
   - Admin-only instrument writes.
4. Share migration notes for frontend auditor page integration.

**Phase 7 Exit Criteria**

1. API documentation reflects all route, query, and role changes.
2. Backend test suite passes without regressions.
3. Manual smoke checks confirm key role-based user journeys.

### Phase 7 Verification Notes (Current)

1. Documentation status:
   - OpenAPI includes instrument filtering and audit routes:
     - `GET /api/instruments?instrumentType=&query=&page=&size=`
     - `GET /api/audit/users?query=&page=&size=`
     - `GET /api/audit/order-logs?userId=&date=&status=&ticker=&instrumentType=&page=&size=`
     - Drilldowns for portfolios/holdings/lots/matches under `/api/audit/**`
   - `QUERIES.md` includes SQL/JPQL intent for audit user search, day-scoped audit order-log filters, and drilldowns.
2. Automated verification status:
   - Focused RBAC/audit suites pass:
     - `AuditServiceTest`
     - `InstrumentServiceTest`
     - `PrivilegedAccessServiceTest`
   - Full `mvnw test` currently has environment-sensitive instability in this workspace due to tests that initialize Kafka-admin clients against `localhost:9092` when no broker is present.
3. Manual smoke verification checklist remains required in an environment with auth roles and dependent services available.

### Frontend Auditor Migration Notes

1. Replace any prior cross-user data assumptions with the new audit endpoints under `/api/audit/**`; retail pages should continue using ownership-scoped routes.
2. Instrument browser/search UI should send optional `query`, `instrumentType`, `page`, and `size` to `GET /api/instruments` for all authenticated roles.
3. Auditor user search UI contract:
   - Endpoint: `GET /api/audit/users`
   - Required: non-empty `query`
   - Optional: `page` (default `0`), `size` (default `25`, max `100`)
4. Auditor order-log UI contract:
   - Endpoint: `GET /api/audit/order-logs`
   - Required: `date` (`YYYY-MM-DD`, day-only semantics)
   - Optional: `userId`, `status`, `ticker`, `instrumentType`, `page`, `size`
5. Drilldown routing guidance:
   - User -> portfolios: `GET /api/audit/users/{userId}/portfolios`
   - User/portfolio -> holdings: `GET /api/audit/users/{userId}/holdings?portfolioId=`
   - Holding -> lots: `GET /api/audit/holdings/{holdingId}/position-lots`
   - Holding -> matches: `GET /api/audit/holdings/{holdingId}/lot-matches`
6. Authorization UX expectation:
   - `RETAIL_CLIENT` should not be shown audit navigation.
   - `AUDITOR` and `ADMIN` can access audit routes.
   - Instrument write UI should remain admin-only.

## Execution Sequence and Dependencies

1. Phase 1 must complete before implementation begins.
2. Phase 2 should land before any new audit endpoint work to stabilize shared authorization behavior.
3. Phase 3 should land before Phase 5 if order-log ticker/type filtering reuses instrument filter helpers or repository patterns.
4. Phase 4 and Phase 6 can proceed in parallel after Phase 2 if team capacity allows.
5. Phase 5 should merge after Phase 2 and alongside finalized date-filter test fixtures.
6. Phase 7 runs last and should include a release-readiness check against this plan.

## Detailed Execution Checklist

1. Finalize route signatures and query parameter names in controllers.
2. Add or update privileged-access guard methods and call sites.
3. Implement repository methods with deterministic sort and pagination.
4. Implement service-layer validation for required query and bounds.
5. Add minimal DTOs for audit search/list responses.
6. Add controller tests for role access matrix by endpoint.
7. Add service/repository tests for filter semantics and boundary behavior.
8. Run full backend tests and triage regressions before merge.
9. Update API docs and role matrix tables.
10. Execute manual smoke validation with admin, auditor, and retail test users.

## Risk Register and Mitigations

1. Risk: Unstable page ordering causes duplicate/missing records across pages.
   - Mitigation: Enforce explicit sort keys in every pageable query.
2. Risk: Date boundary behavior differs by timezone assumptions.
   - Mitigation: Normalize date boundary construction in service layer and add boundary tests.
3. Risk: Overexposure of user details in audit search response payloads.
   - Mitigation: Use dedicated DTOs with minimal required fields.
4. Risk: Cross-user repository queries accidentally reused by retail routes.
   - Mitigation: Keep auditor and ownership-scoped methods separate and covered by access tests.
5. Risk: Query complexity for order-log + instrument filters hurts performance.
   - Mitigation: Keep filters index-friendly and validate query plan with representative data.

## Release Readiness Gate

1. All phase exit criteria marked complete.
2. All testing checklist items marked complete.
3. API documentation and migration notes published.
4. No unresolved high-severity defects related to RBAC or audit data correctness.

## Suggested Endpoint Set

1. GET `/api/instruments?instrumentType=&query=&page=&size=`
2. GET `/api/audit/users?query=&page=&size=`
3. GET `/api/audit/users/{userId}/portfolios?page=&size=`
4. GET `/api/audit/users/{userId}/holdings?portfolioId=&page=&size=`
5. GET `/api/audit/holdings/{holdingId}/position-lots?page=&size=`
6. GET `/api/audit/holdings/{holdingId}/lot-matches?page=&size=`
7. GET `/api/audit/order-logs?userId=&date=&status=&ticker=&instrumentType=&page=&size=`

## Core Files to Change

1. `src/main/java/io/github/jackhudsonn/jaakd/service/PrivilegedAccessService.java`
2. `src/main/java/io/github/jackhudsonn/jaakd/controller/InstrumentController.java`
3. `src/main/java/io/github/jackhudsonn/jaakd/service/InstrumentService.java`
4. `src/main/java/io/github/jackhudsonn/jaakd/repository/InstrumentRepository.java`
5. `src/main/java/io/github/jackhudsonn/jaakd/controller/OrderLogController.java`
6. `src/main/java/io/github/jackhudsonn/jaakd/service/OrderLogService.java`
7. `src/main/java/io/github/jackhudsonn/jaakd/repository/OrderLogRepository.java`
8. `src/main/java/io/github/jackhudsonn/jaakd/controller/ProfileController.java` or a new `AuditController.java`
9. `src/main/java/io/github/jackhudsonn/jaakd/repository/ProfileRepository.java`
10. `src/main/java/io/github/jackhudsonn/jaakd/repository/UserRepository.java`
11. `src/main/java/io/github/jackhudsonn/jaakd/repository/PortfolioRepository.java`
12. `src/main/java/io/github/jackhudsonn/jaakd/repository/HoldingRepository.java`
13. `src/main/java/io/github/jackhudsonn/jaakd/repository/PositionLotRepository.java`
14. `src/main/java/io/github/jackhudsonn/jaakd/repository/LotMatchRepository.java`
15. `src/main/java/io/github/jackhudsonn/jaakd/dto/*` (new audit DTOs and optional instrument filter DTO updates)
16. `src/test/java/io/github/jackhudsonn/jaakd/service/PrivilegedAccessServiceTest.java`
17. `src/test/java/io/github/jackhudsonn/jaakd/controller/*` (audit and instrument authorization tests)
18. `src/test/java/io/github/jackhudsonn/jaakd/service/*` (search and filter behavior tests)

## Testing Checklist

1. Role authorization matrix test coverage for instrument endpoints.
2. User instrument filtering coverage (ticker/query, instrument type, combined filters, pagination).
3. Auditor user search functional coverage (field matching + pagination).
4. Date-only filter correctness coverage using same-day and boundary timestamps.
5. Auditor order-log filter coverage for ticker and instrument type.
6. Auditor drilldown endpoint coverage for portfolios, holdings, lots, and matches.
7. Regression coverage to confirm retail ownership-scoped behavior remains unchanged.

## Non-Functional Guardrails

1. Pagination required on all list endpoints with configurable bounds.
2. Deterministic sort required to prevent unstable pages.
3. Return minimal PII fields in search results.
4. Keep query methods index-friendly where possible.
5. Keep ownership checks untouched for non-audit routes.
