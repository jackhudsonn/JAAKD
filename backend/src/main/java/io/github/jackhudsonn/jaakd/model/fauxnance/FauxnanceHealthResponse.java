package io.github.jackhudsonn.jaakd.service.fauxnance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FauxnanceHealthResponse(
    String status,
    Boolean healthy,
    String message
) {
}
