package io.github.jackhudsonn.jaakd.model.fauxnance;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// The "data" object of GET /candles/{symbol}; candles are ascending by date and priced in currency.
@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceCandleResponse(
    String symbol,
    String currency,
    List<FauxnanceCandle> candles
) {
}
