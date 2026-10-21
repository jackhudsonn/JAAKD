package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateWatchlistRequest(
    @NotBlank(message = "Watchlist name is required")
    String watchlistName
) {
}
