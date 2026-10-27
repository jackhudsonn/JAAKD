package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.util.UUID;

// Pseudonymous by design: no names, emails, DOB or portfolio names leave the production database.
// Retail portfolios only, so there's no user type.
public record PortfolioPerformanceResponse(
    UUID portfolioId,
    UUID userId,
    String country,
    String ageBand,
    BigDecimal marketValueUsd,
    BigDecimal return1w,
    BigDecimal return1m,
    BigDecimal return3m,
    BigDecimal returnYtd,
    BigDecimal volatilityAnn,
    BigDecimal maxDrawdown,
    BigDecimal realizedPnlUsd,
    BigDecimal unrealizedPnlUsd
) {
}
