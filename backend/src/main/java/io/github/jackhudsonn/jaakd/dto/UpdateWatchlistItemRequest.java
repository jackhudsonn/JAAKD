package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.Size;

public record UpdateWatchlistItemRequest(
        @Size(max = 255, message = "Watchlist item name must not exceed 255 characters")
        String name
) {
}
