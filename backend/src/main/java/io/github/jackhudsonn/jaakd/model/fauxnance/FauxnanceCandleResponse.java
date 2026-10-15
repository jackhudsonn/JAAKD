package io.github.jackhudsonn.jaakd.service.fauxnance;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceCandleResponse(
    String symbol,
    List<FauxnanceCandle> candles
) {
}
