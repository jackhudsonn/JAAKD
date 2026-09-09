package com.example.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import com.example.backend.model.TransactionSide;

import java.util.UUID;

// Request body for POST /api/transactions/create — validated by Spring before it reaches TransactionService.
public record TransactionDtos(
    @NotNull(message = "portfolioId is required") UUID portfolioId,
    @NotNull(message = "amount is required") @Positive(message = "Amount must be positive") Long amount,
    @NotNull(message = "side is required") TransactionSide side,
    @NotNull(message = "currency is required") String currency
) {}