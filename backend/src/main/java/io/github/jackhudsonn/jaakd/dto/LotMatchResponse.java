package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

public record LotMatchResponse(
    UUID lotMatchId,
    UUID sellLogOrderId,
    UUID positionLotId,
    UUID holdingId,
    BigDecimal matchedQuantity,
    BigDecimal sellUnitPrice,
    BigDecimal realizedPnlAmount,
    ZonedDateTime matchedAt
) {
}
