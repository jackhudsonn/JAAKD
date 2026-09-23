package io.github.jackhudsonn.jaakd.exception;

public class WatchlistItemConflictException extends ConflictException {

    public WatchlistItemConflictException() {
        super("Watchlist item already exists for this portfolio and instrument");
    }
}