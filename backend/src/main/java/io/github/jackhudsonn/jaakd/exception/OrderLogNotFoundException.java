package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class OrderLogNotFoundException extends ResourceNotFoundException {

    public OrderLogNotFoundException(UUID orderLogId) {
        super("Order log not found for id: " + orderLogId);
    }
}