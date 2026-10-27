package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;
import java.util.List;

// One age band or country: its retail portfolios, their combined value and average YTD return, and how their
// investments split across instrument classes (cash excluded).
public record SegmentSummaryResponse(
    String segment,
    long portfolioCount,
    BigDecimal marketValueUsd,
    BigDecimal averageReturnYtd,
    List<SegmentClassExposure> classes
) {
}
