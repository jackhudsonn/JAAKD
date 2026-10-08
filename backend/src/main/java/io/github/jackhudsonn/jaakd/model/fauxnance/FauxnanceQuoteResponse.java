package io.github.jackhudsonn.jaakd.service.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceQuoteResponse(
    String symbol,
    Double price,
    Double bid,
    Double ask,
    String currency,
    String asOf,
    String marketState
) {
}
