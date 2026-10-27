package io.github.jackhudsonn.jaakd.dto.analytics;

import java.math.BigDecimal;

// How much one segment (an age band or a country) holds in a chosen class or instrument, next to everything
// it has invested (cash excluded), so segments of different sizes can be compared by share.
public record SegmentExposureResponse(
    String segment,
    BigDecimal exposureUsd,
    long holderCount,
    BigDecimal segmentTotalUsd
) {
}
