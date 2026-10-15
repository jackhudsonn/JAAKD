package io.github.jackhudsonn.jaakd.dto;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CashConversionRequest(
    @NotNull(message = "Source currency is required")
    CashCurrency sourceCurrency,

    @NotNull(message = "Target currency is required")
    CashCurrency targetCurrency,

    @NotNull(message = "Source amount is required")
    @DecimalMin(value = "0.000001", message = "Source amount must be greater than 0")
    BigDecimal sourceAmount,

    @Size(max = 4000, message = "Metadata must not exceed 4000 characters")
    String metadata
) {
}
