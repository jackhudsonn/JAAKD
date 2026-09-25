package io.github.jackhudsonn.jaakd.exception;

import io.github.jackhudsonn.jaakd.model.OrderStatus;

import java.util.UUID;

public class OrderCancellationConflictException extends ConflictException {

    public OrderCancellationConflictException(UUID orderId, OrderStatus currentStatus) {
        super("Cannot cancel order " + orderId + " while status is " + currentStatus);
    }
}
