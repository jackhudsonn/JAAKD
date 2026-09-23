package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class InstrumentNotFoundException extends ResourceNotFoundException {

    public InstrumentNotFoundException(UUID instrumentId) {
        super("Instrument not found for id: " + instrumentId);
    }

    public InstrumentNotFoundException(String ticker) {
        super("Instrument not found for ticker: " + ticker);
    }
}