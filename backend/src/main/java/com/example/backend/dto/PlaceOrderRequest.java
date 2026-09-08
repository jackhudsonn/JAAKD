package com.example.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

// Request body for POST /api/orders/place — validated by Spring before it reaches OrdersService.
public record PlaceOrderRequest(
    @NotNull(message = "portfolioId is required") UUID portfolioId,
    @NotNull(message = "instrumentId is required") UUID instrumentId,
    @NotNull(message = "quantity is required") @Positive(message = "Quantity must be positive") Long quantity,
    @NotNull(message = "initPrice is required") @Positive(message = "Price must be positive") Double initPrice,
    @NotNull(message = "side is required") @Pattern(regexp = "(?i)buy|sell", message = "Side must be 'buy' or 'sell'") String side) {
}

