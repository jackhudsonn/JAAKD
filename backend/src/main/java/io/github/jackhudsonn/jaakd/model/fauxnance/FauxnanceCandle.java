package io.github.jackhudsonn.jaakd.service.fauxnance;

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
