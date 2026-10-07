package io.github.jackhudsonn.jaakd.event;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderRejectedEvent(
    UUID orderId,
    UUID sourceLogOrderId,
    String reason,
    LocalDateTime rejectedAt
) {
}
