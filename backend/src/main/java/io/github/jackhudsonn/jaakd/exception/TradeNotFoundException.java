package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class TradeNotFoundException extends ResourceNotFoundException {

    public TradeNotFoundException(UUID tradeId) {
        super("Trade not found for id: " + tradeId);
    }
}