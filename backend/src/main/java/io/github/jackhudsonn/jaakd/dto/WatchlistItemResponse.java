package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record WatchlistItemResponse(
        UUID listItemId,
        UUID watchlistId,
        UUID instrumentId
) {
}
