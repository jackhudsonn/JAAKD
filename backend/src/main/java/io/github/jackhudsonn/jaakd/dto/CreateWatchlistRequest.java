package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateWatchlistRequest(
    @NotBlank(message = "Watchlist name is required")
    String watchlistName
) {
}
