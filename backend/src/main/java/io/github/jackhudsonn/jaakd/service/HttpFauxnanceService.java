package io.github.jackhudsonn.jaakd.service;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import jakarta.annotation.PreDestroy;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.github.jackhudsonn.jaakd.config.FauxnanceProperties;
import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceHealthResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceSymbolResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceUsageResponse;

@Service
public class HttpFauxnanceService implements FauxnanceService {

    private final RestTemplate fauxnanceRestTemplate;
    private final ObjectMapper objectMapper;
    private final FauxnanceProperties fauxnanceProperties;
    private final ExecutorService fauxnanceRequestExecutor;
    private final ScheduledExecutorService fauxnanceRetryScheduler;

    public HttpFauxnanceService(
        RestTemplate fauxnanceRestTemplate,
        ObjectMapper objectMapper,
        FauxnanceProperties fauxnanceProperties
    ) {
        this.fauxnanceRestTemplate = fauxnanceRestTemplate;
        this.objectMapper = objectMapper;
        this.fauxnanceProperties = fauxnanceProperties;
        this.fauxnanceRequestExecutor = Executors.newVirtualThreadPerTaskExecutor();
        this.fauxnanceRetryScheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "fauxnance-retry-scheduler");
            thread.setDaemon(true);
            return thread;
        });
    }

    @Override
    public FauxnanceHealthResponse getHealth() {
        return await(getHealthAsync());
    }

    @Override
    public CompletableFuture<FauxnanceHealthResponse> getHealthAsync() {
        return getJsonWithRetryAsync("/health")
            .thenApply(json -> toValue(json, FauxnanceHealthResponse.class, "/health"));
    }

    @Override
    public FauxnanceUsageResponse getUsage() {
        return await(getUsageAsync());
    }

    @Override
    public CompletableFuture<FauxnanceUsageResponse> getUsageAsync() {
        return getJsonWithRetryAsync("/usage")
            .thenApply(json -> toValue(json, FauxnanceUsageResponse.class, "/usage"));
    }

    @Override
    public FauxnanceSymbolResponse getSymbol(String symbol) {
        return await(getSymbolAsync(symbol));
    }

    @Override
    public CompletableFuture<FauxnanceSymbolResponse> getSymbolAsync(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        return getJsonWithRetryAsync("/symbols/{symbol}", Map.of("symbol", normalizedSymbol))
            .thenApply(this::parseSymbolResponse);
    }

    @Override
    public FauxnanceCandleResponse getCandles(String symbol) {
        return await(getCandlesAsync(symbol));
    }

    @Override
    public CompletableFuture<FauxnanceCandleResponse> getCandlesAsync(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        return getJsonWithRetryAsync("/candles/{symbol}", Map.of("symbol", normalizedSymbol))
            .thenApply(json -> toValue(json, FauxnanceCandleResponse.class, "/candles/{symbol}"));
    }

    @Override
    public List<FauxnanceQuoteResponse> getQuotes(List<String> symbols) {
        return await(getQuotesAsync(symbols));
    }

    @Override
    public CompletableFuture<List<FauxnanceQuoteResponse>> getQuotesAsync(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return CompletableFuture.failedFuture(
                new FauxnanceClientException("At least one symbol is required for /quotes")
            );
        }

        int maxBatchSize = fauxnanceProperties.getQuotes().getMaxBatchSize();
        if (symbols.size() > maxBatchSize) {
            return CompletableFuture.failedFuture(new FauxnanceClientException(
                "Fauxnance quote batch size exceeded: requested " + symbols.size() + ", max " + maxBatchSize
            ));
        }

        List<String> normalizedSymbols = symbols.stream()
            .map(this::normalizeSymbol)
            .toList();

        String symbolsQueryValue = String.join(",", normalizedSymbols);
        return getJsonWithRetryAsync(
            "/quotes",
            Map.of(),
            Map.of("symbols", symbolsQueryValue)
        ).thenApply(root -> parseQuotes(root, normalizedSymbols));
    }

    private JsonNode getJsonWithRetry(String path) {
        return await(getJsonWithRetryAsync(path));
    }

    private JsonNode getJsonWithRetry(String path, Map<String, String> uriVariables) {
        return await(getJsonWithRetryAsync(path, uriVariables));
    }

    private JsonNode getJsonWithRetry(String path, Map<String, String> uriVariables, Map<String, String> queryParams) {
        return await(getJsonWithRetryAsync(path, uriVariables, queryParams));
    }

    private CompletableFuture<JsonNode> getJsonWithRetryAsync(String path) {
        return getJsonWithRetryAsync(path, Map.of());
    }

    private CompletableFuture<JsonNode> getJsonWithRetryAsync(String path, Map<String, String> uriVariables) {
        return getJsonWithRetryAsync(path, uriVariables, Map.of());
    }

    private CompletableFuture<JsonNode> getJsonWithRetryAsync(
        String path,
        Map<String, String> uriVariables,
        Map<String, String> queryParams
    ) {
        int maxAttempts = fauxnanceProperties.getRetry().getMaxAttempts();
        long backoffMillis = fauxnanceProperties.getRetry().getBackoff().toMillis();
        CompletableFuture<JsonNode> resultFuture = new CompletableFuture<>();
        attemptFetch(path, uriVariables, queryParams, maxAttempts, backoffMillis, 1, resultFuture);
        return resultFuture;
    }

    private void attemptFetch(
        String path,
        Map<String, String> uriVariables,
        Map<String, String> queryParams,
        int maxAttempts,
        long backoffMillis,
        int attempt,
        CompletableFuture<JsonNode> resultFuture
    ) {
        CompletableFuture
            .supplyAsync(() -> fetchJson(path, uriVariables, queryParams), fauxnanceRequestExecutor)
            .whenComplete((json, throwable) -> {
                if (throwable == null) {
                    resultFuture.complete(json);
                    return;
                }

                Throwable cause = unwrap(throwable);
                if (cause instanceof RestClientException restClientException) {
                    if (attempt >= maxAttempts) {
                        resultFuture.completeExceptionally(mapRestClientException(path, restClientException));
                        return;
                    }

                    long delayMillis = Math.max(0, backoffMillis * attempt);
                    fauxnanceRetryScheduler.schedule(
                        () -> attemptFetch(
                            path,
                            uriVariables,
                            queryParams,
                            maxAttempts,
                            backoffMillis,
                            attempt + 1,
                            resultFuture
                        ),
                        delayMillis,
                        TimeUnit.MILLISECONDS
                    );
                    return;
                }

                resultFuture.completeExceptionally(cause);
            });
    }

    private JsonNode fetchJson(String path, Map<String, String> uriVariables, Map<String, String> queryParams) {
        URI uri = buildUri(path, uriVariables, queryParams);

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        String apiKey = fauxnanceProperties.getApiKey();
        if (apiKey != null && !apiKey.isBlank()) {
            headers.set(fauxnanceProperties.getApiKeyHeader(), apiKey);
        }

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = fauxnanceRestTemplate.exchange(uri, HttpMethod.GET, entity, String.class);

        try {
            return objectMapper.readTree(response.getBody());
        } catch (JsonProcessingException ex) {
            throw new FauxnanceClientException("Unable to parse Fauxnance response for path: " + path, ex);
        }
    }

    private URI buildUri(String path, Map<String, String> uriVariables, Map<String, String> queryParams) {
        String baseUrl = fauxnanceProperties.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new FauxnanceClientException("Fauxnance base URL is not configured");
        }

        UriComponentsBuilder builder = UriComponentsBuilder
            .fromUriString(baseUrl)
            .path(path);

        queryParams.forEach((key, value) -> {
            if (value != null && !value.isBlank()) {
                builder.queryParam(key, value);
            }
        });

        return builder.buildAndExpand(uriVariables).toUri();
    }

    private <T> T await(CompletableFuture<T> future) {
        try {
            return future.join();
        } catch (CompletionException ex) {
            Throwable cause = unwrap(ex);
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new FauxnanceClientException("Unexpected Fauxnance client failure", cause);
        }
    }

    private Throwable unwrap(Throwable throwable) {
        if (throwable instanceof CompletionException completionException && completionException.getCause() != null) {
            return completionException.getCause();
        }

        return throwable;
    }

    @PreDestroy
    void shutdownExecutors() {
        fauxnanceRetryScheduler.shutdown();
        fauxnanceRequestExecutor.shutdown();
    }

    private FauxnanceClientException mapRestClientException(String path, RestClientException ex) {
        if (ex instanceof HttpStatusCodeException statusException) {
            return new FauxnanceClientException(
                "Fauxnance request failed for path " + path
                    + " with HTTP " + statusException.getStatusCode()
                    + ": " + statusException.getResponseBodyAsString(),
                ex
            );
        }

        return new FauxnanceClientException("Fauxnance request failed for path " + path, ex);
    }

    private <T> T toValue(JsonNode node, Class<T> targetType, String path) {
        try {
            return objectMapper.treeToValue(node, targetType);
        } catch (JsonProcessingException ex) {
            throw new FauxnanceClientException(
                "Unable to map Fauxnance response for path " + path + " to " + targetType.getSimpleName(),
                ex
            );
        }
    }

    private List<FauxnanceQuoteResponse> parseQuotes(JsonNode root, List<String> requestedSymbols) {
        if (root == null || root.isNull()) {
            return List.of();
        }

        if (root.isArray()) {
            return mapQuoteArray(root);
        }

        JsonNode quotes = root.get("quotes");
        if (quotes != null && quotes.isArray()) {
            return mapQuoteArray(quotes);
        }

        JsonNode data = root.get("data");
        if (data != null) {
            if (data.isArray()) {
                return mapQuoteArray(data);
            }

            JsonNode dataQuotes = data.get("quotes");
            if (dataQuotes != null && dataQuotes.isArray()) {
                return mapQuoteArray(dataQuotes);
            }
        }

        // Support symbol keyed object payloads, e.g. {"AAPL": {...}, "MSFT": {...}}
        if (root.isObject()) {
            Map<String, FauxnanceQuoteResponse> keyedQuotes = new LinkedHashMap<>();
            root.fields().forEachRemaining(entry -> {
                FauxnanceQuoteResponse rawQuote = objectMapper.convertValue(entry.getValue(), FauxnanceQuoteResponse.class);
                String fallbackSymbol = entry.getKey();
                String symbol = rawQuote.symbol() == null || rawQuote.symbol().isBlank()
                    ? fallbackSymbol
                    : rawQuote.symbol();
                keyedQuotes.put(symbol.toUpperCase(), new FauxnanceQuoteResponse(
                    symbol.toUpperCase(),
                    rawQuote.price(),
                    rawQuote.bid(),
                    rawQuote.ask(),
                    rawQuote.currency(),
                    rawQuote.asOf(),
                    rawQuote.marketState()
                ));
            });

            return requestedSymbols.stream()
                .map(String::toUpperCase)
                .map(keyedQuotes::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        }

        throw new FauxnanceClientException("Unrecognized /quotes response shape from Fauxnance");
    }

    private List<FauxnanceQuoteResponse> mapQuoteArray(JsonNode quotesArrayNode) {
        List<FauxnanceQuoteResponse> quotes = new ArrayList<>();

        for (JsonNode quoteItem : quotesArrayNode) {
            if (quoteItem.hasNonNull("error")) {
                String symbol = quoteItem.path("symbol").asText("UNKNOWN");
                String code = quoteItem.path("error").path("code").asText("UNKNOWN_ERROR");
                String message = quoteItem.path("error").path("message").asText("Quote item returned error");
                throw new FauxnanceClientException(
                    "Fauxnance quote error for symbol " + symbol + " [" + code + "]: " + message
                );
            }

            JsonNode quoteNode = quoteItem.has("quote") ? quoteItem.get("quote") : quoteItem;
            FauxnanceQuoteResponse quote = objectMapper.convertValue(quoteNode, FauxnanceQuoteResponse.class);
            String symbol = quote.symbol();
            if (symbol != null) {
                symbol = symbol.toUpperCase();
            }

            quotes.add(new FauxnanceQuoteResponse(
                symbol,
                quote.price(),
                quote.bid(),
                quote.ask(),
                quote.currency(),
                quote.asOf(),
                quote.marketState()
            ));
        }

        return quotes;
    }

    private FauxnanceSymbolResponse parseSymbolResponse(JsonNode root) {
        JsonNode symbolNode = root;
        JsonNode data = root.get("data");
        if (data != null && data.isObject()) {
            symbolNode = data;
        }

        return toValue(symbolNode, FauxnanceSymbolResponse.class, "/symbols/{symbol}");
    }

    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new FauxnanceClientException("Symbol is required");
        }

        return symbol.trim().toUpperCase();
    }
}
