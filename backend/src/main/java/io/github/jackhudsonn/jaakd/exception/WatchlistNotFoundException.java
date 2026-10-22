package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class WatchlistNotFoundException extends ResourceNotFoundException {

    public WatchlistNotFoundException(UUID watchlistId) {
        super("Watchlist not found for id: " + watchlistId);
    }
}
