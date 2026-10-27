package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

// cumulativeTwr is the time-weighted return since the portfolio's first day, so deposits and withdrawals
// don't count as performance.
public record PortfolioValuePoint(
    LocalDate date,
    BigDecimal marketValueUsd,
    BigDecimal cashUsd,
    BigDecimal netExternalFlowUsd,
    BigDecimal dailyReturn,
    BigDecimal cumulativeTwr
) {
}
