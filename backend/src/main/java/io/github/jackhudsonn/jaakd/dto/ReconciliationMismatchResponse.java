package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record ReconciliationMismatchResponse(
    UUID instrumentId,
    Double expectedQuantity,
    Double actualQuantity,
    Double expectedCumulativeRealizedPnl,
    Double actualCumulativeRealizedPnl,
    String reason
) {
}
