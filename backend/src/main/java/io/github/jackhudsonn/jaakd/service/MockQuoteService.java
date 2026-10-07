package io.github.jackhudsonn.jaakd.service;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Primary
public class MockQuoteService implements QuoteService {

    @Override
    public Double getExecutionPrice(UUID instrumentId) {
        // Placeholder deterministic quote source until external market data integration is wired.
        return 100.0;
    }
}
