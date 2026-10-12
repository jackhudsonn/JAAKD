# Auditor Search and Instrument RBAC Implementation Plan

## Objectives

1. Keep instrument read endpoints available to all authenticated users.
2. Restrict instrument write operations (create, update, sync) to admin only.
3. Add auditor-capable cross-user search.
4. Add auditor-capable order-log filtering by day (date-only semantics).
5. Add auditor drilldown reads for portfolios, holdings, position lots, and lot matches.

## Final Policy Decisions

1. Instrument reads are authenticated-only (not public).
2. Instrument writes are admin-only.
3. Auditor endpoints are accessible to admin and auditor roles.
4. Date filtering is day-level only and does not support time-of-day precision.

## Delivery Phases

### Phase 1: RBAC Baseline and Contracts

1. Confirm endpoint contracts and query parameters for audit search and drilldowns.
2. Confirm role boundaries:
   - `RETAIL_CLIENT`: standard ownership-scoped endpoints only.
   - `AUDITOR`: cross-user audit reads.
   - `ADMIN`: cross-user audit reads + instrument writes.
3. Confirm pagination defaults and maximum page size for all new audit list endpoints.

### Phase 2: Lock Instrument Writes to Admin

1. Update instrument write paths to enforce admin-only checks:
   - POST `/api/instruments`
   - PUT `/api/instruments/{instrumentId}`
   - POST `/api/instruments/sync/{ticker}`
2. Keep instrument GET endpoints unchanged for authenticated users:
   - GET `/api/instruments`
   - GET `/api/instruments/{instrumentId}`
   - GET `/api/instruments/ticker/{ticker}`
3. Add/extend privileged checks in `PrivilegedAccessService`:
   - Keep `ensureAdminOrAuditor()` for audit reads.
   - Add `ensureAdmin()` for instrument writes.
4. Add tests to prove:
   - Admin can write.
   - Auditor cannot write.
   - Retail client cannot write.
   - All authenticated roles can read instruments.

### Phase 3: Auditor User Search

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

### Phase 4: Auditor Order-Log Filtering by Day

1. Add auditor endpoint for order-log filtering:
   - Example: GET `/api/audit/order-logs?userId=&instrumentId=&date=&status=&page=&size=`
2. Implement day-based date semantics using boundaries:
   - `start = date.atStartOfDay()`
   - `end = date.plusDays(1).atStartOfDay()`
   - query with `timestamp >= start AND timestamp < end`
3. Keep instrument and status filters optional.
4. Enforce admin-or-auditor check on this endpoint.
5. Add tests for:
   - Includes all logs on requested day.
   - Excludes previous/next day logs.
   - Invalid or missing date handling.

### Phase 5: Auditor Drilldown Endpoints

1. Add auditor user-level reads:
   - User portfolios.
   - User holdings.
2. Add auditor holding-level reads:
   - Position lots by holding.
   - Lot matches by holding.
3. Ensure these endpoints use cross-user repository methods (not ownership-scoped methods used by retail users).
4. Enforce admin-or-auditor guard on all auditor endpoints.
5. Add tests for access control and result correctness.

### Phase 6: Documentation and Verification

1. Update API docs with:
   - New `/api/audit/*` endpoints.
   - Required query parameters.
   - Role matrix for read/write permissions.
2. Run backend tests (`mvnw test`) and fix regressions.
3. Perform manual API smoke tests for:
   - Retail user read-only instrument access.
   - Auditor cross-user audit reads.
   - Admin-only instrument writes.
4. Share migration notes for frontend auditor page integration.

## Suggested Endpoint Set

1. GET `/api/audit/users?query=&page=&size=`
2. GET `/api/audit/users/{userId}/portfolios`
3. GET `/api/audit/users/{userId}/holdings?portfolioId=&page=&size=`
4. GET `/api/audit/holdings/{holdingId}/position-lots`
5. GET `/api/audit/holdings/{holdingId}/lot-matches`
6. GET `/api/audit/order-logs?userId=&instrumentId=&date=&status=&page=&size=`

## Core Files to Change

1. `src/main/java/io/github/jackhudsonn/jaakd/service/PrivilegedAccessService.java`
2. `src/main/java/io/github/jackhudsonn/jaakd/controller/InstrumentController.java`
3. `src/main/java/io/github/jackhudsonn/jaakd/service/InstrumentService.java` (optional defense-in-depth guard)
4. `src/main/java/io/github/jackhudsonn/jaakd/controller/OrderLogController.java`
5. `src/main/java/io/github/jackhudsonn/jaakd/service/OrderLogService.java`
6. `src/main/java/io/github/jackhudsonn/jaakd/repository/OrderLogRepository.java`
7. `src/main/java/io/github/jackhudsonn/jaakd/controller/ProfileController.java` or a new `AuditController.java`
8. `src/main/java/io/github/jackhudsonn/jaakd/repository/ProfileRepository.java`
9. `src/main/java/io/github/jackhudsonn/jaakd/repository/UserRepository.java`
10. `src/main/java/io/github/jackhudsonn/jaakd/repository/PortfolioRepository.java`
11. `src/main/java/io/github/jackhudsonn/jaakd/repository/HoldingRepository.java`
12. `src/main/java/io/github/jackhudsonn/jaakd/repository/PositionLotRepository.java`
13. `src/main/java/io/github/jackhudsonn/jaakd/repository/LotMatchRepository.java`
14. `src/main/java/io/github/jackhudsonn/jaakd/dto/*` (new audit DTOs)
15. `src/test/java/io/github/jackhudsonn/jaakd/service/PrivilegedAccessServiceTest.java`
16. `src/test/java/io/github/jackhudsonn/jaakd/controller/*` (audit and instrument authorization tests)
17. `src/test/java/io/github/jackhudsonn/jaakd/service/*` (search/filter behavior tests)

## Testing Checklist

1. Role authorization matrix test coverage for instrument endpoints.
2. Auditor user search functional coverage (field matching + pagination).
3. Date-only filter correctness coverage using same-day and boundary timestamps.
4. Auditor drilldown endpoint coverage for portfolios, holdings, lots, and matches.
5. Regression coverage to confirm retail ownership-scoped behavior remains unchanged.

## Non-Functional Guardrails

1. Pagination required on all audit list endpoints.
2. Deterministic sort required to prevent unstable pages.
3. Return minimal PII fields in search results.
4. Keep query methods index-friendly where possible.
5. Keep ownership checks untouched for non-audit routes.
