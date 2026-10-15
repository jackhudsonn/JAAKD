package io.github.jackhudsonn.jaakd.dto;

import io.github.jackhudsonn.jaakd.model.CashCurrency;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record CashConversionResponse(
    UUID orderId,
    UUID logOrderId,
    UUID portfolioId,
    CashCurrency sourceCurrency,
    CashCurrency targetCurrency,
    BigDecimal sourceAmount,
    BigDecimal conversionRate,
    BigDecimal targetAmount,
    BigDecimal sourceBalanceAfter,
    BigDecimal targetBalanceAfter,
    String metadata,
    LocalDateTime convertedAt
) {
}
