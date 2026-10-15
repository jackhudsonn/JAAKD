package io.github.jackhudsonn.jaakd.service.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceSymbolResponse(
    String symbol,
    String name,
    String type,
    String exchange,
    String currency,
    String description,
    String logoUrl
) {
}
