package io.github.jackhudsonn.jaakd.service;

import java.util.List;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceHealthResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceSymbolResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceUsageResponse;

public interface FauxnanceService {

    FauxnanceHealthResponse getHealth();

    FauxnanceUsageResponse getUsage();

    FauxnanceSymbolResponse getSymbol(String symbol);

    FauxnanceCandleResponse getCandles(String symbol);

    List<FauxnanceQuoteResponse> getQuotes(List<String> symbols);
}
