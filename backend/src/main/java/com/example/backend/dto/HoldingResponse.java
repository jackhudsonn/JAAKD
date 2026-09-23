package com.example.backend.dto;

import java.util.UUID;

public record HoldingResponse(
        UUID holdingId,
        UUID portfolioId,
        UUID instrumentId,
        double currentQuantity
) {
}
