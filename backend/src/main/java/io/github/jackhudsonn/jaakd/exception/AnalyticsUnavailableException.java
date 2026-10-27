package io.github.jackhudsonn.jaakd.exception;

// The analytics database is switched off, unreachable, or hasn't been built yet; answered with 503.
public class AnalyticsUnavailableException extends RuntimeException {

    public AnalyticsUnavailableException(String message) {
        super(message);
    }

    public AnalyticsUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
