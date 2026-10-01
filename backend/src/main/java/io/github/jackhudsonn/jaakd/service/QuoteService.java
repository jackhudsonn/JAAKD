package io.github.jackhudsonn.jaakd.service;

import java.util.UUID;

public interface QuoteService {
    Double getExecutionPrice(UUID instrumentId);
}
