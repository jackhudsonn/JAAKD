package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record AuditHoldingResponse(
        UUID holdingID,
        UUID portfolioID,
        UUID instrumentID,
        BigDecimal currentQuantity,
        BigDecimal cumulativeRealizedPnl,
        LocalDateTime updatedAt,
        UUID ownerUserId,
        String ownerFirstName,
        String ownerLastName
) {
}
