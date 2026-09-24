package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record PortfolioResponse(
    UUID portfolioId,
    String portfolioName
) {
}
