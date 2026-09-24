package io.github.jackhudsonn.jaakd.dto;

import java.time.ZonedDateTime;
import java.util.UUID;

import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;

public record OrderLogResponse(
        UUID logOrderId,
        UUID orderId,
        UUID portfolioId,
        UUID instrumentId,
        OrderSide side,
        double quantity,
        ZonedDateTime timestamp,
        String metadata,
        OrderStatus status,
        double executionPrice
) {
}
