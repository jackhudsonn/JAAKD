package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateHoldingRequest(
        @NotNull(message = "Portfolio ID is required")
        UUID portfolioId,

        @NotNull(message = "Instrument ID is required")
        UUID instrumentId,

        @DecimalMin(value = "0.0", inclusive = false, message = "Current quantity must be greater than 0")
        double currentQuantity
) {
}
