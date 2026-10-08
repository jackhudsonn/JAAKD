package io.github.jackhudsonn.jaakd.service.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceUsageResponse(
    Integer requestsUsed,
    Integer requestsRemaining,
    Integer requestLimit,
    String windowStart,
    String windowEnd
) {
}
