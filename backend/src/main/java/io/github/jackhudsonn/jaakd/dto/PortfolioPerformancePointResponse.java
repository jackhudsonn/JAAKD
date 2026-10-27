package io.github.jackhudsonn.jaakd.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PortfolioPerformancePointResponse(
    LocalDate date,
    BigDecimal value
) {
}
