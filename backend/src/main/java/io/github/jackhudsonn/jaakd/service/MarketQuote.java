package io.github.jackhudsonn.jaakd.service;

public record MarketQuote(
    String symbol,
    Double price,
    Double bid,
    Double ask,
    String currency,
    String asOf,
    String marketState
) {
}
