package io.github.jackhudsonn.jaakd.service;

import java.util.concurrent.CompletableFuture;
import java.util.List;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceHealthResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceSymbolResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceUsageResponse;

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

    // Bypasses the read cache. Order pricing must reflect the latest upstream quote.
    List<FauxnanceQuoteResponse> getQuotesFresh(List<String> symbols);
}
