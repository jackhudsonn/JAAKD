package io.github.jackhudsonn.jaakd.event;

import io.github.jackhudsonn.jaakd.model.OrderSide;

import java.time.LocalDateTime;
import java.util.UUID;

public record OrderSubmittedEvent(
    UUID orderId,
    UUID logOrderId,
    UUID portfolioId,
    UUID instrumentId,
    OrderSide side,
    double quantity,
    LocalDateTime submittedAt,
    long version
) {
}
