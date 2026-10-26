package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

// One day of a portfolio's holdings in one instrument class, added up. There's no quantity (shares of different
// instruments don't add up) and no time-weighted return (that needs the class's own deposits and withdrawals).
public record ClassValuePoint(
    LocalDate date,
    BigDecimal costBasisUsd,
    BigDecimal marketValueUsd,
    BigDecimal realizedPnlToDateUsd,
    BigDecimal unrealizedPnlUsd
) {
}
