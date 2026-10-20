package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.UUID;

import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;

public record CreateDemoOrderLogRequest(
        @NotNull(message = "Order ID is required")
        UUID orderId,

        @NotNull(message = "Portfolio ID is required")
        UUID portfolioId,

        @NotNull(message = "Instrument ID is required")
        UUID instrumentId,

        @NotNull(message = "Order side is required")
        OrderSide side,

        @DecimalMin(value = "0.000001", message = "Quantity must be greater than 0")
        double quantity,

        @NotNull(message = "Order status is required")
        OrderStatus status,

        @NotNull(message = "Timestamp is required")
        LocalDateTime timestamp,

        @Size(max = 4000, message = "Metadata must not exceed 4000 characters")
        String metadata,

        Double executionPrice,
        Double quotedPrice
) {
}
