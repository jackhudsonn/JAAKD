package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;

// How much one segment (an age band or a country) holds in one instrument class today.
public record SegmentClassExposure(
    String instrumentClass,
    BigDecimal exposureUsd,
    long holderCount
) {
}
