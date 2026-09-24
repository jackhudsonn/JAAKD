package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

import io.github.jackhudsonn.jaakd.model.InstrumentClass;

public record InstrumentResponse(
        UUID instrumentId,
        String ticker,
        String market,
        String name,
        InstrumentClass instrumentClass,
        String logoUrl,
        String description
) {
}
