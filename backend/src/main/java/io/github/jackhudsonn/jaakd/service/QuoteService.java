package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.OrderSide;

import java.util.List;
import java.util.UUID;

public interface QuoteService {

    default Double getExecutionPrice(UUID instrumentId) {
        return getExecutionPrice(instrumentId, null);
    }

    Double getExecutionPrice(UUID instrumentId, OrderSide side);

    MarketQuote getQuote(UUID instrumentId);

    List<MarketQuote> getQuotes(List<UUID> instrumentIds);
}
