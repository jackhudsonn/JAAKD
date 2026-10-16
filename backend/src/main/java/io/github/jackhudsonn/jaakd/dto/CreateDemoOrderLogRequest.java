package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.UUID;

import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;

public record CreateDemoOrderLogRequest(
        @NotNull UUID orderId,
        @NotNull UUID portfolioId,
        @NotNull UUID instrumentId,
        @NotNull OrderSide side,
        @DecimalMin(value = "0.000001") double quantity,
        @NotNull OrderStatus status,
        @NotNull LocalDateTime timestamp,
        @Size(max = 4000) String metadata,
        Double executionPrice
) {
}
