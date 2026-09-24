package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

import io.github.jackhudsonn.jaakd.model.OrderSide;

public record CreateOrderLogRequest(
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

        @Size(max = 4000, message = "Metadata must not exceed 4000 characters")
        String metadata,

        Double executionPrice
) {
}
