package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record HoldingResponse(
        UUID holdingId,
        UUID portfolioId,
        UUID instrumentId,
        double currentQuantity
) {
}
