package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class PaymentMethodNotFoundException extends ResourceNotFoundException {

    public PaymentMethodNotFoundException(UUID paymentMethodId) {
        super("Payment method not found for id: " + paymentMethodId);
    }
}
