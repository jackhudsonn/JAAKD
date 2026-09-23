package com.example.backend.dto;

import com.example.backend.model.InstrumentClass;

import java.util.UUID;

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
