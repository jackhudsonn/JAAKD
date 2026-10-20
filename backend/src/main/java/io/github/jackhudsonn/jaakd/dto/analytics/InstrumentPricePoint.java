package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InstrumentPricePoint(
    LocalDate date,
    BigDecimal close,
    BigDecimal closeUsd,
    BigDecimal dailyReturn,
    BigDecimal cumulativeReturn
) {
}
