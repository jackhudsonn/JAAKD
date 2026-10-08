package io.github.jackhudsonn.jaakd.exception;

public class FauxnanceClientException extends RuntimeException {

    public FauxnanceClientException(String message) {
        super(message);
    }

    public FauxnanceClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
