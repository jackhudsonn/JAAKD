package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class HoldingNotFoundException extends ResourceNotFoundException {

    public HoldingNotFoundException(UUID holdingId) {
        super("Holding not found for id: " + holdingId);
    }
}