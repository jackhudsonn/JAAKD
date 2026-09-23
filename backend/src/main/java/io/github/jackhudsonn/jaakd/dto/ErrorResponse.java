package io.github.jackhudsonn.jaakd.dto;

import java.time.Instant;
import java.util.Map;

// endpoint: /portfolios-holdings/{holding}
public record ErrorResponse(
        Instant timestamp,
        String message,
        Map<String, String> details
) {
}