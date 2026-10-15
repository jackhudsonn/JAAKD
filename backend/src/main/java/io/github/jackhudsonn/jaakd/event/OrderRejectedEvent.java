package io.github.jackhudsonn.jaakd.event;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.UUID;

public record OrderRejectedEvent(
    UUID orderId,
    UUID sourceLogOrderId,
    String reason,
    String reasonCode,
    String requiredCurrency,
    BigDecimal requiredAmount,
    BigDecimal availableAmount,
    BigDecimal shortfall,
    LocalDateTime rejectedAt
) {
}
