package io.github.jackhudsonn.jaakd.dto;

import java.util.List;
import java.util.UUID;

public record WatchlistResponse(
    UUID watchlistId,
    String watchlistName,
    List<WatchlistItemResponse> items
) {
}
