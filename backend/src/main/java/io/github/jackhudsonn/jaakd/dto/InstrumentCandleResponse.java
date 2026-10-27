package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InstrumentCandleResponse(
    LocalDate date,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal close,
    Long volume,
    String currency
) {
}