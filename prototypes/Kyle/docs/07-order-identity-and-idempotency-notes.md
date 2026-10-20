# Order ID Ownership and Idempotency Notes

Context for `POST /api/order-logs` after the AWS deployment exposed the
frontend's `crypto.randomUUID()` dependency. `randomUUID` is restricted to
secure contexts, so it is unavailable when the app is served over plain HTTP.
The deeper problem is ownership: the client was minting the `orderId` that the
backend uses as the logical order identity.

## Decision: the backend owns `orderId`

Implemented in this change:

- `CreateOrderLogRequest` no longer accepts `orderId`.
- `OrderLogService.createOrderLog` generates it with `UUID.randomUUID()`.
- The existing `OrderLogResponse.orderId` returns the server-assigned value.
- The frontend uses the response's `orderId` for polling and cancellation
  instead of generating one before submission.
- The lifecycle lab no longer exposes editable order IDs; cancellation is
  available per order in the timeline.

`orderId` is a grouping key shared by every log entry of one logical order. It
is not a per-row primary key (`logOrderID` is), and it is not unique across
`orderLogs`. The client must not control it. Because lifecycle consumers look
up orders by `orderId`, a client that reuses an existing value could otherwise
append events to another user's order stream.

## Why no client-supplied idempotency key yet

A client-generated idempotency key would restore retry safety without restoring
order identity, but it still leaves the important value under client control.
The frontend can generate a new key on each retry, lose the key across a reload,
or reuse one key for a genuinely different order. That makes it a partial
mitigation, not an ownership fix.

Idempotency is also cross-cutting. Not every endpoint needs it, and adding a
one-off key to order creation would not establish a pattern for the rest of the
API. It belongs in a separate issue.

## Known limitation after this change

`POST /api/order-logs` is not idempotent:

- Double submission or an automatic retry creates a second order.
- If the server commits but the response is lost, the client cannot tell
  whether the order exists.
- The frontend must disable submission while in flight and must not retry
  automatically. After an unknown outcome, check order history rather than
  blindly resubmitting.

This limitation is deliberate for now. Removing client-minted IDs fixes the
ownership and HTTP-availability problem; it does not add duplicate protection.

## Candidate design for the separate idempotency issue

The sustainable direction is for the backend to create a server-owned handle
and for subsequent calls to operate on it. Two variants fit:

1. **Server-issued submission token.** An authenticated endpoint issues a
   short-lived, one-time token scoped to the user. Order submission sends the
   token; the backend locks the token row, creates the order if the token is
   still `ISSUED`, and marks it `CONSUMED` with the resulting `orderId` and
   `logOrderID`. Retries with the same token replay the stored result.
2. **Draft order.** The backend creates a draft order first and returns its
   `orderId`; a later submit/confirm call transitions it. This is more natural
   domain-wise but adds a draft lifecycle and more state.

The token variant is the lighter option and matches the "generate a
server-owned handle, then operate on it" model without inventing a new order
status.

Refined token design:

- Token is a server-generated UUID; no client randomness.
- Token row records `userID`, status (`ISSUED`/`CONSUMED`), `requestHash`,
  `orderID`, `logOrderID`, issue time, and expiry.
- Submission locks the row `FOR UPDATE`; token consumption and order creation
  happen in one transaction.
- Same token + same payload hash replays the original response; different
  payload returns `409`.
- Expired `ISSUED` rows can be cleaned up. `CONSUMED` rows should be retained
  with order history, since deleting them reopens old retries.
- The issued-token endpoint needs authentication, rate limiting, and a
  retention/cleanup policy.

This infrastructure is non-trivial: an extra round trip, a new table and state
machine, row locking and recovery behavior, expiry/cleanup, CORS for any custom
header, migration of existing deployments, and tests for replay/conflict. It
should not be smuggled into the order-ID ownership change.

It also does not solve event-loss after commit. If the order is persisted but
the Kafka publish fails, an idempotency token prevents a duplicate order but
does not ensure the event is published. That remains an outbox concern.

## Why this matters for future agents

- Do not add `orderId` back to the create request, even as "optional".
- Do not reintroduce client-side `crypto.randomUUID()` for order identity.
- Do not treat a client-supplied idempotency key as equivalent to a
  server-issued token; the client can still misuse its own key.
- If idempotency is implemented, make it a general API concern and define
  replay, conflict, expiry, and cleanup semantics before adding the table.
- Keep `orderId` as the server-assigned logical order identity; keep
  `logOrderID` as the append-only row identity.

## Scope note

- This note documents the ownership decision and the deferred idempotency
  direction.
- No idempotency token, draft order, or deduplication table is implemented
  here.
