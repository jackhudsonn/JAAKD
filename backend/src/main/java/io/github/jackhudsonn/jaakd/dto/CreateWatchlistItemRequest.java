package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateWatchlistItemRequest(
        @NotNull(message = "Portfolio ID is required")
        UUID portfolioId,

        @NotNull(message = "Instrument ID is required")
        UUID instrumentId,

        @Size(max = 255, message = "Watchlist item name must not exceed 255 characters")
        String name
) {
}
