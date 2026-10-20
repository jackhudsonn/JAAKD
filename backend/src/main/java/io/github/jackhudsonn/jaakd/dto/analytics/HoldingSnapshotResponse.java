package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record HoldingSnapshotResponse(
    UUID holdingId,
    UUID instrumentId,
    String ticker,
    String name,
    String instrumentClass,
    LocalDate asOfDate,
    BigDecimal quantity,
    BigDecimal costBasisUsd,
    BigDecimal marketValueUsd,
    BigDecimal realizedPnlToDateUsd,
    BigDecimal unrealizedPnlUsd
) {
}
