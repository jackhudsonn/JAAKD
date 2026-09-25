package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

public record PositionLotResponse(
    UUID positionLotId,
    UUID holdingId,
    UUID sourceBuyLogOrderId,
    ZonedDateTime openedAt,
    BigDecimal originalQuantity,
    BigDecimal remainingQuantity,
    BigDecimal unitCost
) {
}
