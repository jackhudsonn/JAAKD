# Fauxnance Integration Plan

## Goal
Align all Fauxnance naming and payload handling to the current contract first, then implement FX and currency sufficiency controls so users can only trade instruments when they hold enough cash in the instrument's trading currency.

## Scope Decisions
- Provider scope: Fauxnance only.
- Priority 1: Naming and payload alignment with `FauxnanceContract.json`.
- Enum alignment is part of Priority 1 and must be completed before FX behavior work.
- Execution pricing policy: BUY uses ask, SELL uses bid.
- Trade behavior: reject-only when required currency cash is insufficient (no auto conversion during submit).
- FX behavior: explicit user-triggered cash conversion endpoint.
- Market-open gating and pending revalidation queue are deferred to a final optional phase and may be excluded from the current commit.
- Candle persistence: out of scope for this phase.
- Health and usage behavior: read-only observability, no hard request gating.
- Kafka topology: preserve existing topics and lifecycle flow.

## Phase 1 (Priority 1): Contract Naming and Shape Alignment
1. Align Fauxnance symbol metadata models to contract semantics:
   - map `type`, `exchange`, and `currency` from provider payloads.
   - remove dependency on stale `market`/`instrumentClass` naming at integration boundary.
2. Align quote batch endpoint usage to contract:
   - use `GET /quotes?symbols=...` (up to 25), not path-variable style.
3. Align quote response parsing to contract envelopes:
   - handle `data.quotes[]` items with either `quote` or `error` payload.
   - preserve symbol ordering and deterministic error handling.
4. Define canonical mapping rules between Fauxnance and local domain:
   - `type -> InstrumentClass`
   - `exchange -> market/exchange display field`
   - `currency -> instrument trading currency source`
5. Add adapter tests that prove contract alignment before any FX or trading logic changes.
6. Normalize local enums to match contract/domain intent:
   - update `OrderSide` to include `FX` for conversion operations.
   - align `InstrumentClass` with supported provider/local options (at least EQUITY, ETF, FX, CRYPTO, CASH), and remove/retire conflicting legacy values.
   - define migration and compatibility behavior for existing persisted enum values.

### Phase 1 Enum Target Set (Planning Baseline)
1. `OrderSide` target values:
   - BUY
   - SELL
   - DEPOSIT
   - WITHDRAW
   - FX
2. `InstrumentClass` target values:
   - EQUITY
   - ETF
   - FX
   - CRYPTO
   - CASH
3. `CashCurrency` target values (initial set):
   - USD
   - INR
   - GBP
   - EUR
4. Extensibility rule:
   - add-only for new currencies unless a major-version migration is planned.

### Phase 1 Enum Deprecation and Mapping Plan
1. `InstrumentClass` legacy-to-target mapping:
   - STOCK -> EQUITY
   - BOND -> ETF
   - existing EQUITY/ETF/CASH/CRYPTO remain unchanged
   - STOCK and BOND are permanently retired and must not appear in new writes
2. Provider-to-local mapping rule for instrument class:
   - provider `type=equity` -> EQUITY
   - provider `type=etf` -> ETF
   - provider `type=fx` -> FX
   - provider `type=crypto` -> CRYPTO
3. Currency code normalization rule:
   - uppercase ISO code required
   - reject unknown codes with deterministic validation error
   - optionally support transitional alias handling for known bad inputs (for example `GBD` -> `GBP`) behind explicit migration logging
4. Order side compatibility rule:
   - existing BUY/SELL/DEPOSIT/WITHDRAW behavior unchanged
   - FX side only enabled after conversion flow endpoints/services are in place
5. Data migration checkpoints:
   - scan and report existing DB values before enum tightening
   - apply value remapping migrations before runtime enum enforcement
   - add post-migration verification queries to confirm no orphan legacy enum strings remain

## Phase 1.5: Cash Currency Enum Introduction
1. Add a new enum for cash currencies (ISO-style), for example:
   - USD
   - INR
   - GBP
   - extensible for future currencies
2. Define where this enum is authoritative in local domain:
   - instrument trading currency field
   - cash instrument resolution logic
   - FX conversion request validation
3. Define persistence/API strategy:
   - enum storage format in DB and JSON
   - handling unknown/unsupported currency codes
4. Add backward-compatibility and data-migration checks before wiring runtime behavior.

## Phase 2: Fauxnance Client Boundary Hardening
1. Keep/complete `FauxnanceService` abstraction for:
   - `/health`
   - `/usage`
   - `/symbols/{symbol}`
   - `/candles/{symbol}`
   - `/quotes?symbols=...`
2. Ensure Fauxnance config in `application.yaml` includes:
   - base URL
   - timeout values
   - retry count/backoff
   - quote batch cap (25)
3. Keep deterministic HTTP timeout/retry behavior in config package.
4. Normalize provider errors into typed service exceptions.

## Phase 3: Currency-Aware Instrument Domain
1. Add `tradingCurrency` to local `Instrument` model and persistence, backed by the new cash currency enum.
2. Extend instrument DTOs and controller responses to include `tradingCurrency`.
3. Update instrument sync (`createOrUpdateFromExternalData`) to source trading currency from Fauxnance symbol metadata.
4. Apply DB schema updates under `backend/db/init`:
   - add instrument trading currency column + constraints.
   - seed required cash instruments for MVP (USD, INR at minimum).

## Phase 4: Quote and Execution Service Consumers
1. Keep `QuoteService` as the production abstraction with side-aware pricing.
2. Keep `MockQuoteService` for dev/test only.
3. Ensure `OrderLogService` submit quoting remains through `QuoteService`.
4. Ensure `FifoAccountingService` execution pricing and failure handling remain deterministic.
5. Ensure `ExecutionService` maps retry-exhausted quote failures to existing FAILED append path.

## Phase 5: Pre-Trade Currency Sufficiency Validation
1. Replace hardcoded cash ticker priority behavior with currency-resolved cash lookup.
2. Validate BUY notional against the cash holding for instrument `tradingCurrency`.
3. Reject when required currency cash is missing or insufficient.
4. Standardize rejection metadata details for UI:
   - reason code
   - required currency
   - required amount
   - available amount
   - shortfall

## Phase 6: FX Cash Conversion Capability
1. Add explicit conversion endpoint (portfolio-scoped) to exchange cash balances between currencies.
2. Implement atomic conversion flow:
   - validate ownership and request
   - resolve source/target cash instruments
   - fetch Fauxnance FX rate
   - verify source balance
   - debit source and credit target
   - persist audit metadata
3. Ensure DEPOSIT/WITHDRAW flows support non-USD cash instruments consistently.

## Phase 7: Kafka and Lifecycle Safeguards
1. Preserve existing event chain:
   - ORDER_SUBMITTED
   - ORDER_ACCEPTED or ORDER_REJECTED
   - execution handling (EXECUTED/FAILED)
2. Do not add new Kafka topics unless a concrete consumer need appears.
3. Verify no duplicate append transitions under retries/failures.

## Phase 8: Testing and Validation (Core Commit Scope)
1. Fauxnance adapter tests (must pass first):
   - symbol metadata naming alignment
   - quote batch path/query shape
   - envelope parsing with mixed success/error quote items
   - single symbol, max batch (25), overflow rejection
2. Service tests:
   - `OrderLogService` quote behavior
   - `ValidationService` currency sufficiency rejection/acceptance
   - `FifoAccountingService` currency-correct cash debit/credit
   - FX conversion service success/failure paths
3. Lifecycle integration checks:
   - quote success path
   - retry then fail path
   - reject due to wrong/insufficient currency, then pass after conversion
4. Verify Kafka flow and topic names remain unchanged.

## Phase 9: Optional Follow-up (Market Open + Batch Queue)
1. Add market-open session gating behavior for trade validation.
2. Add Spring Batch revalidation flow for market-closed pending orders:
   - read only orders whose latest lifecycle status is `PENDING`
   - re-check market state and business validations in chunked/idempotent steps
   - append `ACCEPTED` only when market state is `open`; otherwise leave status as latest `PENDING`
   - avoid duplicate transitions under concurrent triggers by using existing locking patterns
3. Add Spring Batch validation checks:
   - job processes only latest-pending orders
   - restart/retry safety (no duplicate ACCEPTED/REJECTED appends)
   - chunk/page sizing and schedule cadence are bounded and observable
4. Add lifecycle check for deferred orders:
   - closed market leads to pending, then Spring Batch promotion to accepted after market open

## Implementation Order
1. Phase 1 (hard gate)
2. Phase 1.5 (hard gate)
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9 (optional / can be excluded from current commit)

## Expected File Touches
- `backend/FauxnanceContract.json` (reference only)
- `src/main/resources/application.yaml`
- `src/main/java/io/github/jackhudsonn/jaakd/service/FauxnanceService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/HttpFauxnanceService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/model/fauxnance/FauxnanceSymbolResponse.java`
- `src/main/java/io/github/jackhudsonn/jaakd/model/fauxnance/FauxnanceQuoteResponse.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/QuoteService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/MockQuoteService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/OrderLogService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/FifoAccountingService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/ExecutionService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/InstrumentService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/model/Instrument.java`
- `src/main/java/io/github/jackhudsonn/jaakd/model/InstrumentClass.java`
- `src/main/java/io/github/jackhudsonn/jaakd/model/OrderSide.java`
- `src/main/java/io/github/jackhudsonn/jaakd/model/CashCurrency.java` (new)
- `src/main/java/io/github/jackhudsonn/jaakd/dto/CreateInstrumentRequest.java`
- `src/main/java/io/github/jackhudsonn/jaakd/dto/InstrumentResponse.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/ValidationService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/service/HoldingService.java`
- `src/main/java/io/github/jackhudsonn/jaakd/controller/HoldingController.java`
- `backend/db/init/01-schema.sql`

### Optional Follow-up File Touches (Phase 9)
- `src/main/java/io/github/jackhudsonn/jaakd/batch/**` (new Spring Batch job, reader/processor/writer config)
- `src/main/java/io/github/jackhudsonn/jaakd/service/ValidationService.java` (market-open gating behavior)
- `src/main/java/io/github/jackhudsonn/jaakd/repository/OrderLogRepository.java` (latest-pending selectors for batch)

## Completion Criteria
- Fauxnance naming/path/envelope handling matches the contract in production adapters.
- Local enums are normalized and consistent with contract/domain intent:
   - `OrderSide` includes `FX`.
   - `InstrumentClass` is aligned to supported options.
   - cash currency enum exists and is used by currency-aware flows.
- Legacy enum values are mapped or migrated with verification evidence before strict runtime enforcement.
- Instrument sync correctly maps provider `type`, `exchange`, and `currency`.
- Pre-trade validation blocks buys without sufficient required-currency cash.
- Users can convert cash balances explicitly via FX endpoint and then trade.
- Retry-exhausted quote failures still produce FAILED lifecycle entries.
- Existing Kafka topic flow remains intact.
- Tests cover contract alignment plus key success/failure paths for currency checks and FX conversion.

### Optional Follow-up Completion Criteria (Phase 9)
- Orders submitted while market is closed remain `PENDING` and are promoted by Spring Batch when market state becomes `open`.
- Market-open guardrail behavior is enforced according to configured order/session policy.
