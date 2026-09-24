package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdatePortfolioRequest(
    @NotBlank(message = "Portfolio name cannot be blank")
    @Size(max = 100, message = "Portfolio name must not exceed 100 characters")
    String portfolioName
) {
}
