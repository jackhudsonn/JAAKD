package com.example.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

// Request body for POST /api/orders/place — validated by Spring before it reaches OrdersService.
public record TransactionDtos(
    @NotNull(message = "portfolioId is required") UUID portfolioId,
    @NotNull(message = "amount is required") @Positive(message = "Amount must be positive") Long amount,
    @NotNull(message = "side is required") @Pattern(regexp = "(?i)deposite|withdraw", message = "Side must be 'deposite' or 'withdraw'") String side,
    @NotNull(message = "currency is required") String currency) {
}

