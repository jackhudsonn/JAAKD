package io.github.jackhudsonn.jaakd.model.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceHealthResponse(
    String status,
    Boolean healthy,
    String message
) {
}
