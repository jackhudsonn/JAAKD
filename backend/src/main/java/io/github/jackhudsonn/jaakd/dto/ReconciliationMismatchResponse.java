package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ReconciliationMismatchResponse(
    UUID instrumentId,
    BigDecimal expectedQuantity,
    BigDecimal actualQuantity,
    BigDecimal expectedCumulativeRealizedPnl,
    BigDecimal actualCumulativeRealizedPnl,
    String reason
) {
}
