package io.github.jackhudsonn.jaakd.exception;

public class InstrumentConflictException extends ConflictException {

    public InstrumentConflictException(String ticker) {
        super("Instrument already exists for ticker: " + ticker);
    }
}