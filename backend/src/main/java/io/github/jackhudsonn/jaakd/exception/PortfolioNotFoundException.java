package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class PortfolioNotFoundException extends ResourceNotFoundException {

    public PortfolioNotFoundException(UUID portfolioId) {
        super("Portfolio not found for id: " + portfolioId);
    }
}