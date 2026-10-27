package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.util.UUID;

// Returns and drawdown are fractions (0.05 = 5%); null when there isn't enough price history for the window.
public record InstrumentPerformanceResponse(
    UUID instrumentId,
    String ticker,
    String name,
    String market,
    String instrumentClass,
    String tradingCurrency,
    BigDecimal lastCloseUsd,
    BigDecimal return1w,
    BigDecimal return1m,
    BigDecimal return3m,
    BigDecimal returnYtd,
    BigDecimal volatilityAnn,
    BigDecimal maxDrawdown,
    long holderCount,
    BigDecimal exposureUsd,
    BigDecimal netFlow30dUsd
) {
}
