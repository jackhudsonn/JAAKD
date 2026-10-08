package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.OrderSide;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class MockQuoteService implements QuoteService {

    @Override
    public Double getExecutionPrice(UUID instrumentId, OrderSide side) {
        // Placeholder deterministic quote source until external market data integration is wired.
        return 100.0;
    }

    @Override
    public MarketQuote getQuote(UUID instrumentId) {
        return new MarketQuote("MOCK", 100.0, 99.9, 100.1, "USD", null, "open");
    }

    @Override
    public List<MarketQuote> getQuotes(List<UUID> instrumentIds) {
        return instrumentIds.stream()
            .map(id -> getQuote(id))
            .toList();
    }
}
