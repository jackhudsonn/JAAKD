package io.github.jackhudsonn.jaakd.service;

import java.util.concurrent.CompletableFuture;
import java.util.List;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceHealthResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceSymbolResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceUsageResponse;

public interface FauxnanceService {

    FauxnanceHealthResponse getHealth();

    CompletableFuture<FauxnanceHealthResponse> getHealthAsync();

    FauxnanceUsageResponse getUsage();

    CompletableFuture<FauxnanceUsageResponse> getUsageAsync();

    FauxnanceSymbolResponse getSymbol(String symbol);

    CompletableFuture<FauxnanceSymbolResponse> getSymbolAsync(String symbol);

    FauxnanceCandleResponse getCandles(String symbol);

    CompletableFuture<FauxnanceCandleResponse> getCandlesAsync(String symbol);

    List<FauxnanceQuoteResponse> getQuotes(List<String> symbols);

    CompletableFuture<List<FauxnanceQuoteResponse>> getQuotesAsync(List<String> symbols);
}
