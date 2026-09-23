package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class WatchlistItemNotFoundException extends ResourceNotFoundException {

    public WatchlistItemNotFoundException(UUID listItemId) {
        super("Watchlist item not found for id: " + listItemId);
    }
}