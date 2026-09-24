package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.DecimalMin;

public record UpdateHoldingRequest(
        @DecimalMin(value = "0.0", message = "Current quantity cannot be negative")
        Double currentQuantity
) {
}
