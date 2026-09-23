package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class TradeConflictException extends ConflictException {

    public TradeConflictException(UUID orderLogId) {
        super("Trade already exists for order log: " + orderLogId);
    }
}