package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;

// One row per instrument class. positionCount counts open portfolio positions, so a portfolio holding
// two equities counts twice.
public record ClassSummaryResponse(
    String instrumentClass,
    long instrumentCount,
    long positionCount,
    BigDecimal exposureUsd,
    BigDecimal averageReturn1m
) {
}
