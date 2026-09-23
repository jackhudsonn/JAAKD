package com.example.backend.dto;

import java.util.UUID;

public record PortfolioResponse(
    UUID portfolioId,
    String portfolioName
) {
}
