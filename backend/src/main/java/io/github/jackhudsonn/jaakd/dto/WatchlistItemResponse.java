package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record WatchlistItemResponse(
        UUID listItemId,
        UUID portfolioId,
        UUID instrumentId,
        String name
) {
}
