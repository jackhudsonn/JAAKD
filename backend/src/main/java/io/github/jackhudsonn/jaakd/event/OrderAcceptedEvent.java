package io.github.jackhudsonn.jaakd.event;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderAcceptedEvent(
    UUID orderId,
    UUID sourceLogOrderId,
    LocalDateTime acceptedAt
) {
}
