package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

public record HoldingValuePoint(
    LocalDate date,
    BigDecimal quantity,
    BigDecimal costBasisUsd,
    BigDecimal marketValueUsd,
    BigDecimal realizedPnlToDateUsd,
    BigDecimal unrealizedPnlUsd
) {
}
