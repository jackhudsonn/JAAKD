# Phase 1 Domain Invariants

This phase formalizes accounting invariants and validates them against current FIFO behavior.

## Invariants in active scope

1. Holding quantity invariant (non-cash instrument holdings)
- `holding.currentQuantity` equals the sum of `remainingQuantity` across that holding's open `position_lots` after a SELL operation.

2. Sell match quantity invariant
- For one executed sell log, the sum of `lot_matches.matchedQuantity` equals the executed sell quantity.

3. Lot bounds invariant
- For each lot, `0 <= remainingQuantity <= originalQuantity`.

4. Realized PnL invariant
- `holding.cumulativeRealizedPnl` equals the sum of `lot_matches.realizedPnlAmount` created for the sell event.

5. Idempotency invariant
- Reprocessing the same executed BUY/SELL log does not re-apply side effects.

## Verification implementation

These invariants are asserted in unit tests in:
- `backend/src/test/java/io/github/jackhudsonn/jaakd/service/FifoAccountingServiceTest.java`

## Cash invariant status

Cash-specific invariant (`cash holding quantity never negative`) is defined but deferred to Phase 3 Pt 2, when DEPOSIT/WITHDRAW routing is implemented.
