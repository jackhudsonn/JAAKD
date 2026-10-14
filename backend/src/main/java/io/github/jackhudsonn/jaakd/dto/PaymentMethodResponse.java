package io.github.jackhudsonn.jaakd.dto;

import java.time.Instant;
import java.util.UUID;

public record PaymentMethodResponse(
    UUID paymentMethodId,
    String nickname,
    String accountHolderName,
    String bankName,
    String accountType,
    String routingLast4,
    String accountLast4,
    Instant createdAt,
    Instant updatedAt
) {
}
