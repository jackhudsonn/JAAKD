# Trading Platform — Postgres/Supabase Schema (v1 / MVP)

Status: draft for review. Written against the answers gathered in the clarifying
round (see "Assumptions" below). Nothing here is final SQL — it's the contract
the team should agree on before writing migrations.

## 1. Assumptions locked in from clarifying questions

- **Execution**: simulated/internal fill engine for MVP. No external broker/exchange
  connectivity yet, but the order/trade model is shaped so a real venue integration
  can plug in later (see §7).
- **Instruments**: multi-asset from day one — equities, options, futures, FX, crypto.
  Handled with a discriminator + JSONB attributes column, not one table per asset class.
- **Order types**: market, limit, stop, stop-limit. Minimal `time_in_force` (`day`, `gtc`)
  included because stop orders are meaningless without it; extra TIFs (`ioc`, `fok`) are
  a data-only addition later, not a schema change.
- **Money movement**: no real bank integration at MVP. A "fake bank" ledger
  (`app.bank_transfers`) simulates deposits/withdrawals. Postgres is the system of
  record for the cash ledger (`public.transactions`).
- **Identity/roles**: Supabase Auth (`auth.users`) is the single identity provider for
  everyone — retail clients, traders, staff, auditors. Role is *not* a claim you trust
  blindly off the JWT; it's a row in `app.user_roles` checked via a `SECURITY DEFINER`
  helper function, so granting/revoking access doesn't require re-issuing tokens.
- **Accounts**: one trading account per client for MVP, enforced with a `UNIQUE`
  constraint on `accounts.owner_id` rather than folding account fields into the client
  profile — so relaxing "one account per client" later is a constraint drop, not a
  re-model.
- **Reporting**: basic materialized views included now, isolated in their own
  `reporting` schema so refreshes never block OLTP writes. Tradeoffs for outgrowing
  this are discussed in §8.
- **Kafka**: event bus only, fed via a transactional outbox table. Postgres remains the
  sole durable system of record; Kafka never holds data that doesn't also exist in
  Postgres.

## 2. Schema layout

Four Postgres schemas, each with a distinct trust boundary:

| Schema | Exposed via Supabase API (PostgREST)? | Written by | Purpose |
|---|---|---|---|
| `public` | Yes | Spring Boot backend (privileged role); read by Angular via RLS | Client-facing domain data: accounts, orders, trades, positions, cash ledger, reference data |
| `app` | No | Spring Boot backend only | Internal mechanics: roles, order state audit trail, outbox, idempotency, risk limits, generic audit log, fake bank ledger |
| `reporting` | Yes, but RLS-locked to `staff`/`auditor` roles | Scheduled job / materialized view refresh | Pre-aggregated analytics, decoupled refresh cadence |
| `auth` | Supabase-managed | Supabase | Identity, passwords, sessions — never duplicated elsewhere |

**Why not just one schema?** Supabase exposes whatever schemas you opt into over
PostgREST. Putting audit/event/idempotency machinery in `app` means it's structurally
impossible for the Angular client to query or tamper with it directly (no grants, not
in the exposed-schema list) — it's not just an RLS policy that could be misconfigured,
it's absent from the API surface entirely. Client and staff traffic hits `public`
(and `reporting`); Spring Boot alone talks to `app` over a direct JDBC connection with
its own Postgres role.

**Why the client doesn't INSERT orders directly:** Even though `orders` lives in
`public` and is readable by the owning client, all writes to `orders`/`trades`/
`transactions`/`positions` are restricted to the backend's privileged role. Placing an
order still "feels" direct-to-client (no staff intervention, no ticket), but it goes
through the Spring Boot API so idempotency, risk checks, and the outbox event are
guaranteed atomic with the row insert. Letting the client write straight into the table
via the Supabase SDK would mean risk/idempotency logic would need to live in triggers
instead of application code, which is harder to test and evolve. The client still gets
near-real-time visibility via Supabase Realtime subscriptions on `orders`/`trades`
(read-only).

## 3. Roles / RBAC

```
app.roles            -- lookup: retail_client | trader | staff | auditor | service
app.user_roles        -- (user_id, role_code) grants — many-to-many, auditable
app.has_role(role_code text) returns boolean  -- SECURITY DEFINER helper used in RLS
```

**`app.roles`**
| column | type | null? | notes |
|---|---|---|---|
| role_code | text | PK | `retail_client`, `trader`, `staff`, `auditor`, `service` |
| description | text | not null | |

**`app.user_roles`**
| column | type | null? | notes |
|---|---|---|---|
| user_id | uuid | not null | FK → `auth.users(id)` |
| role_code | text | not null | FK → `app.roles(role_code)` |
| granted_at | timestamptz | not null, default `now()` | |
| granted_by | uuid | nullable | FK → `auth.users(id)`, who granted it (null = system/seed) |

PK `(user_id, role_code)` — a user can hold more than one role (e.g. a `trader` who is
also `staff`). This table is never exposed to the API; role changes go through the
backend, which is itself an auditable action logged in `app.audit_log`.

## 4. `public` schema

### `public.profiles`
| column | type | null? | notes |
|---|---|---|---|
| user_id | uuid | PK, FK → `auth.users(id)` on delete cascade | |
| display_name | text | not null | |
| kyc_status | text | not null, default `'pending'` | `pending` / `verified` / `rejected` |
| created_at | timestamptz | not null, default `now()` | |

RLS: `select`/`update` where `user_id = auth.uid()`; `staff`/`auditor` get `select` on
all rows via `app.has_role()`. No client-side `insert`/`delete` — row is created by a
trigger on `auth.users` (standard Supabase pattern) or by the backend on first login.

**Not stored here:** KYC documents (passport scans, proof of address). Those are large
binary blobs with their own retention/compliance rules — store them in Supabase
Storage and keep only the storage path + verification status/timestamp in a
`kyc_documents` table if/when needed. Keeping blobs out of Postgres keeps the OLTP
database small and backups fast.

### `public.accounts`
| column | type | null? | notes |
|---|---|---|---|
| account_id | uuid | PK, default `gen_random_uuid()` | |
| owner_id | uuid | not null, FK → `auth.users(id)` | `UNIQUE` — enforces one account per client for MVP |
| currency | text | not null, default `'USD'` | ISO 4217 |
| status | text | not null, default `'active'` | `active` / `suspended` / `closed` |
| cash_balance | numeric(18,2) | not null, default `0` | cache, maintained by trigger from `transactions`; **not** the source of truth |
| created_at | timestamptz | not null, default `now()` | |

RLS: `select` where `owner_id = auth.uid()`; `staff`/`auditor` see all. `insert`/`update`
restricted to backend role. Dropping the `UNIQUE(owner_id)` constraint is the entire
migration needed to support multiple accounts per client later.

`cash_balance` is a denormalized cache kept in sync by an `AFTER INSERT` trigger on
`public.transactions` (`SUM(amount)` scoped to the account), so the dashboard doesn't
need to aggregate the whole ledger on every read. `public.transactions` remains the
reconcilable source of truth if the cache ever drifts.

### `public.asset_classes` (lookup, reference data)
| column | type | null? | notes |
|---|---|---|---|
| asset_class_code | text | PK | `equity`, `option`, `future`, `fx`, `crypto` |
| description | text | not null | |

### `public.instruments`
| column | type | null? | notes |
|---|---|---|---|
| instrument_id | uuid | PK, default `gen_random_uuid()` | |
| symbol | text | not null, `UNIQUE` | e.g. `AAPL`, `EURUSD`, `BTC-USD` |
| asset_class_code | text | not null, FK → `public.asset_classes` | discriminator |
| exchange | text | nullable | null for OTC/crypto/FX pairs |
| currency | text | not null | quote currency |
| tick_size | numeric(18,8) | not null, default `0.01` | |
| lot_size | numeric(18,8) | not null, default `1` | |
| status | text | not null, default `'active'` | `active` / `halted` / `delisted` |
| attributes | jsonb | not null, default `'{}'` | asset-class-specific fields (option strike/expiry/underlying, future contract size/expiry, etc.) |
| created_at | timestamptz | not null, default `now()` | |

RLS: `select` for any authenticated user (reference data, no ownership concept).
`insert`/`update` restricted to backend/admin. The `attributes` JSONB column is the
extensibility point for new asset classes — adding options support doesn't need a
schema migration, just an agreed JSON shape and application-level validation.

### `public.orders`
| column | type | null? | notes |
|---|---|---|---|
| order_id | uuid | PK, default `gen_random_uuid()` | |
| account_id | uuid | not null, FK → `public.accounts` | |
| instrument_id | uuid | not null, FK → `public.instruments` | |
| side | text | not null | `buy` / `sell` |
| order_type | text | not null | `market` / `limit` / `stop` / `stop_limit` |
| time_in_force | text | not null, default `'day'` | `day` / `gtc` |
| limit_price | numeric(18,8) | nullable | required iff `order_type in ('limit','stop_limit')` (check constraint) |
| stop_price | numeric(18,8) | nullable | required iff `order_type in ('stop','stop_limit')` (check constraint) |
| quantity | numeric(18,8) | not null | `check (quantity > 0)` |
| remaining_quantity | numeric(18,8) | not null | decremented as fills happen |
| status | text | not null, default `'pending_risk_check'` | see `app.order_status` lookup for the full lifecycle |
| client_order_id | text | not null | client-generated idempotency key |
| submitted_at | timestamptz | not null, default `now()` | |
| updated_at | timestamptz | not null, default `now()` | bumped on every state change |
| version | integer | not null, default `1` | optimistic concurrency for concurrent fill/cancel races |

Constraints: `UNIQUE(account_id, client_order_id)` (idempotent submission),
`CHECK` linking `order_type` to required price fields.

RLS: `select` where `account_id` belongs to `auth.uid()`; `staff`/`auditor` see all.
No client `insert`/`update`/`delete` grants — see §2 for rationale. The backend writes
through its service role.

**Status values** live in `app.order_status` (a lookup table, not a native Postgres
`ENUM`) so adding a new status (e.g. `partially_filled_pending_cancel`) is an `INSERT`,
not an `ALTER TYPE` that takes a table lock.

### `public.trades`
| column | type | null? | notes |
|---|---|---|---|
| trade_id | uuid | PK, default `gen_random_uuid()` | |
| order_id | uuid | not null, FK → `public.orders` | |
| account_id | uuid | not null, FK → `public.accounts` | denormalized from the order for cheaper RLS + queries |
| instrument_id | uuid | not null, FK → `public.instruments` | |
| side | text | not null | |
| quantity | numeric(18,8) | not null | `check (quantity > 0)` |
| price | numeric(18,8) | not null | `check (price > 0)` |
| fee | numeric(18,8) | not null, default `0` | |
| executed_at | timestamptz | not null, default `now()` | |

**Immutable**: no `update`/`delete` grants for anyone, including the backend role.
Corrections happen via a compensating trade, never by editing history — this is what
makes "answer a dispute without reconstruction work" possible: the trade table
*is* the record.

RLS: `select` scoped to account ownership; `staff`/`auditor` unrestricted.

### `public.positions`
| column | type | null? | notes |
|---|---|---|---|
| account_id | uuid | PK part, FK → `public.accounts` | |
| instrument_id | uuid | PK part, FK → `public.instruments` | |
| quantity | numeric(18,8) | not null, default `0` | |
| avg_cost | numeric(18,8) | not null, default `0` | |
| updated_at | timestamptz | not null, default `now()` | |

Derived cache maintained by the backend after each trade — **not** authoritative.
`public.trades` is the source of truth; positions can always be rebuilt by replaying
trades for an account. RLS scoped the same way as orders/trades.

### `public.transactions` (cash ledger)
| column | type | null? | notes |
|---|---|---|---|
| transaction_id | uuid | PK, default `gen_random_uuid()` | |
| account_id | uuid | not null, FK → `public.accounts` | |
| type | text | not null | `deposit` / `withdrawal` / `fee` / `dividend` / `interest` / `tax_withholding` / `trade_settlement` |
| amount | numeric(18,2) | not null | signed: positive = credit, negative = debit |
| currency | text | not null, default `'USD'` | |
| related_order_id | uuid | nullable, FK → `public.orders` | set for `trade_settlement` rows |
| related_transfer_id | uuid | nullable, FK → `app.bank_transfers` | set for deposit/withdrawal rows; cross-schema FK, fine internally, not exposed via API since `app` isn't in the exposed-schema list |
| status | text | not null, default `'posted'` | `pending` / `posted` / `reversed` |
| description | text | nullable | |
| created_at | timestamptz | not null, default `now()` | |

**Immutable append-only ledger** — reversals are new rows with `status='reversed'`
linkage, never `UPDATE`/`DELETE`. This is what satisfies "complete record... without
reconstruction work" for cash movements, matching the terminology already in the
project README (transactions = cash, trades = position changes).

RLS: `select` scoped to account ownership; `staff`/`auditor` unrestricted; no client
write grants (deposits/withdrawals go through the backend, which creates the
`app.bank_transfers` row and the resulting `transactions` row together).

## 5. `app` schema (backend-only, never exposed to PostgREST)

### `app.order_status` (lookup)
`pending_risk_check`, `accepted`, `rejected`, `partially_filled`, `filled`,
`cancel_requested`, `cancelled`, `expired`. Backing table so new statuses are inserts,
not migrations.

### `app.order_events` (immutable event log — the audit trail)
| column | type | null? | notes |
|---|---|---|---|
| event_id | bigint | PK, `identity` | |
| order_id | uuid | not null, FK → `public.orders` | |
| event_type | text | not null | `submitted`, `risk_check_passed`, `risk_check_failed`, `accepted`, `partial_fill`, `filled`, `cancel_requested`, `cancelled`, `rejected`, `expired` |
| previous_status | text | nullable | |
| new_status | text | not null | |
| payload | jsonb | not null, default `'{}'` | snapshot of relevant fields at event time (price, qty, reason) |
| actor_id | uuid | nullable, FK → `auth.users` | null for pure system events |
| actor_type | text | not null, default `'system'` | `client` / `staff` / `system` |
| occurred_at | timestamptz | not null, default `now()` | |

No `update`/`delete` grants for any role. This table, together with `public.trades`
and `public.transactions`, is the "reconstruct any dispute or regulatory query without
reconstruction work" answer — it's already reconstructed, permanently.

### `app.outbox_events` (transactional outbox → Kafka)
| column | type | null? | notes |
|---|---|---|---|
| outbox_id | bigint | PK, `identity` | |
| aggregate_type | text | not null | `order` / `trade` / `transaction` |
| aggregate_id | uuid | not null | |
| event_type | text | not null | |
| payload | jsonb | not null | |
| created_at | timestamptz | not null, default `now()` | |
| published_at | timestamptz | nullable | set by the publisher once handed to Kafka |
| kafka_topic | text | nullable | |

Partial index on `published_at IS NULL` for the publisher's poll query. Writing to
`orders`/`trades`/`transactions` and `outbox_events` happens in the same DB transaction
in the backend, so an event is never lost or double-published-without-a-record — the
standard transactional-outbox pattern, needed because Kafka and Postgres can't share
a two-phase commit.

### `app.idempotency_keys`
| column | type | null? | notes |
|---|---|---|---|
| account_id | uuid | PK part, FK → `public.accounts` | |
| client_order_id | text | PK part | |
| order_id | uuid | nullable, FK → `public.orders` | set once the order is created |
| created_at | timestamptz | not null, default `now()` | |

Belt-and-suspenders alongside the `UNIQUE(account_id, client_order_id)` constraint on
`orders` — lets the backend short-circuit a retried request before even attempting an
insert.

### `app.risk_limits`
| column | type | null? | notes |
|---|---|---|---|
| account_id | uuid | PK, FK → `public.accounts` | |
| max_order_notional | numeric(18,2) | not null | |
| max_daily_notional | numeric(18,2) | not null | |
| max_position_qty | numeric(18,8) | nullable | null = no limit |
| updated_at | timestamptz | not null, default `now()` | |

### `app.audit_log` (generic staff/admin action log)
| column | type | null? | notes |
|---|---|---|---|
| audit_id | bigint | PK, `identity` | |
| table_name | text | not null | |
| record_id | text | not null | |
| action | text | not null | `insert` / `update` / `delete` / `manual_adjustment` |
| actor_id | uuid | not null, FK → `auth.users` | |
| actor_role | text | not null | role in effect at time of action |
| before_data | jsonb | nullable | |
| after_data | jsonb | nullable | |
| reason | text | nullable | required (enforced at application layer) for `manual_adjustment` |
| occurred_at | timestamptz | not null, default `now()` | |

Covers anything `order_events`/`transactions` don't — e.g. a staff member manually
suspending an account or overriding a risk limit.

### `app.bank_transfers` (fake bank for MVP)
| column | type | null? | notes |
|---|---|---|---|
| transfer_id | uuid | PK, default `gen_random_uuid()` | |
| account_id | uuid | not null, FK → `public.accounts` | |
| direction | text | not null | `deposit` / `withdrawal` |
| amount | numeric(18,2) | not null | `check (amount > 0)` |
| currency | text | not null, default `'USD'` | |
| status | text | not null, default `'pending'` | `pending` / `completed` / `failed` |
| external_ref | text | nullable | placeholder for a real payment processor reference later |
| requested_at | timestamptz | not null, default `now()` | |
| settled_at | timestamptz | nullable | |

Simulates a bank rail today; when real banking integration lands, this table gains a
webhook/callback path and `external_ref` starts pointing at a real provider — no
structural change needed.

## 6. `reporting` schema (analytics, decoupled from live trading)

### `reporting.daily_trading_volume` (materialized view)
Grouped by `trade_date`, `instrument_id`: `total_quantity`, `total_notional`,
`trade_count`. Sourced from `public.trades`.

### `reporting.client_activity_summary` (materialized view)
Grouped by `account_id`, `period`: `order_count`, `trade_count`, `total_volume`,
`total_fees`. Sourced from `public.orders`/`public.trades`.

Refreshed on a schedule (`REFRESH MATERIALIZED VIEW CONCURRENTLY`, e.g. via `pg_cron`
or a Spring Boot scheduled job) — never inline with order/trade writes, so heavy
aggregation can't slow down live trading. Exposed via the API but RLS-restricted to
`staff`/`auditor` roles only (checked with `app.has_role()`); retail clients have no
access.

## 7. Extensibility — how this survives "add a capability later"

- **New asset class** → add a row to `asset_classes`, agree a JSON shape for
  `instruments.attributes`. No migration.
- **New order status / event type** → insert into the lookup table. No `ALTER TYPE`,
  no table lock.
- **Real broker/exchange execution** → `orders`/`trades` already model
  partial fills and an async status lifecycle; swapping the internal fill engine for a
  real venue integration is a backend service change, not a schema change. The
  `app.outbox_events` table already gives the integration point for publishing order
  state to whatever consumes it (e.g. a smart order router).
- **Real bank/payment integration** → `app.bank_transfers.external_ref` plus a new
  status transition path; `public.transactions` doesn't change at all.
- **New consumer of trading events** (e.g. a notifications service, a fraud-detection
  service) → subscribes to the Kafka topics fed by the outbox. It doesn't need direct
  DB access or new tables in the OLTP schema at all.
- **New roles** (e.g. `compliance_officer`) → insert into `app.roles`, write new RLS
  policies/`app.has_role()` checks. Existing roles/policies untouched.

## 8. Reporting: Postgres now vs. a warehouse later (tradeoffs)

**MVP recommendation: keep it in Postgres**, in the isolated `reporting` schema above.
At MVP volume, a couple of materialized views refreshed every few minutes is simple,
free (no new infra), and keeps everything queryable with plain SQL/PostgREST from one
place.

**When to move it out:**
- If materialized view refresh times start competing with OLTP for I/O/CPU on the
  same instance, move reporting queries to a **Postgres read replica** first — a
  small operational change, no data-model change.
- If reporting needs true ad-hoc/BI-style analytics (arbitrary slicing across years of
  history, joins across huge fact tables), that's a sign to feed a **columnar
  warehouse** (BigQuery/Snowflake/ClickHouse) via Kafka Connect reading the
  `app.outbox_events` topic(s) — since the outbox already emits every order/trade/
  transaction event, no new instrumentation is needed to feed a warehouse later.
- Either path is additive: `reporting` schema stays as the "fast, good-enough" answer
  and a warehouse becomes the "deep history, heavy analytics" answer without ripping
  anything out.

## 9. Explicitly NOT part of this schema (and where it belongs instead)

| Data | Why excluded | Where it belongs |
|---|---|---|
| Card/bank account numbers, payment credentials | PCI-DSS scope; storing raw payment credentials creates compliance burden this project doesn't need yet | Tokenized reference from a payment processor, when real banking is integrated; `app.bank_transfers.external_ref` is the placeholder |
| KYC documents (ID scans, proof of address) | Large binary blobs, different retention/legal-hold rules than transactional data | Supabase Storage bucket; only a status + storage path reference in Postgres |
| Passwords, session tokens, MFA secrets | Already Supabase Auth's job; duplicating it is a security liability, not a feature | `auth.users` / Supabase Auth internals |
| Live order-book / tick-by-tick market data | Extremely high write volume/velocity, wrong shape for an OLTP row-store; would overwhelm Postgres and bloat backups | A market-data pipeline (Kafka topics + a time-series store, e.g. TimescaleDB/ClickHouse, or a vendor feed queried live); Postgres only needs a last-traded-price cache if the UI needs one |
| Long-tail historical audit/event data (multi-year retention) | Keeping every event forever in the hot OLTP database inflates backup/restore time and vacuum cost | Periodic archive of `app.order_events`/`app.audit_log` to cold storage/object storage once past a retention window (e.g. 2 years); application logic doesn't need to change, just an archival job |
| Heavy BI aggregation beyond the two materialized views above | Wrong tool once queries need arbitrary historical slicing | Columnar warehouse fed from the outbox, see §8 |

## 10. Open questions before writing migrations

- Exact `time_in_force` set beyond `day`/`gtc` (do we need `ioc`/`fok` for the
  simulated fill engine at MVP, or later)?
- Multi-currency accounts: is `accounts.currency` single-currency per account
  (assumed here) or do we need per-currency sub-balances?
- Retention window for `app.order_events`/`app.audit_log` before archival (regulatory
  requirement will dictate this — likely 5–7 years for a trading firm, but confirm).
- Whether `staff`/`trader` roles need write access to any `public` tables directly
  (e.g. staff placing an order on a client's behalf), or strictly read + the same
  backend API path as clients.
