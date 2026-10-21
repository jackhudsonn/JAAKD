package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateWatchlistEntryRequest(
    @NotNull(message = "Instrument ID is required")
    UUID instrumentId
) {
}
