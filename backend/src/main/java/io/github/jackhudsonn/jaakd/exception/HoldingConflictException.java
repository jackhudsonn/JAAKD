package io.github.jackhudsonn.jaakd.exception;

public class HoldingConflictException extends ConflictException {

    public HoldingConflictException() {
        super("Holding already exists for this portfolio and instrument");
    }
}