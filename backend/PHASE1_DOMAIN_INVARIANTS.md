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

## Portfolio deletion invariants (Phase 1)

1. True-empty deletion invariant
- A portfolio can be deleted only if it has no active order logs and no holdings with positive quantity.

2. Active-order guard invariant
- Any owned order log with status `SUBMITTED`, `PENDING`, or `ACCEPTED` blocks portfolio deletion.

3. Positive-holding guard invariant
- Any owned holding with `currentQuantity > 0` blocks portfolio deletion.

4. Cash-included emptiness invariant
- Cash is represented in `holdings`, so positive cash quantity also blocks deletion.

5. Zero-residual tolerance invariant
- Zero-quantity residual holdings do not block portfolio deletion.
