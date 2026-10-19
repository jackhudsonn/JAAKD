package io.github.jackhudsonn.jaakd.model.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceCandle(
    String date,
    Double open,
    Double high,
    Double low,
    Double close,
    Double volume
) {
}
