package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateTradeRequest(
        // Optional: if omitted, service will find or create a holding using the order log's portfolio+instrument.
        UUID holdingId,

        @NotNull(message = "Order log ID is required")
        UUID orderLogId
) {
}
