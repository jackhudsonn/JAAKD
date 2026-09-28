package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record PositionLotResponse(
    UUID positionLotId,
    UUID holdingId,
    UUID sourceBuyLogOrderId,
    LocalDateTime openedAt,
    BigDecimal originalQuantity,
    BigDecimal remainingQuantity,
    BigDecimal unitCost
) {
}
