# Phase 0 Scope Lock

This file captures the agreed boundary before Phase 1+ implementation work.

## Included sides

- `BUY`
- `SELL`
- `DEPOSIT`
- `WITHDRAW`

## Accounting boundary in current implementation

- `FifoAccountingService` handles only `BUY` and `SELL`.
- `DEPOSIT` and `WITHDRAW` are intentionally rejected in FIFO service.
- Non-`EXECUTED` order logs produce no projection side effects.

## Cash design decision

- No separate cash table in this phase.
- Cash will be represented as a dedicated cash instrument row in `holdings`.
- Deposit/withdraw execution routing will be implemented in Phase 3 Pt 2.

## Out of scope

- Shorting / margin
- Corporate actions
- FX conversion
- Non-FIFO tax-lot variants
