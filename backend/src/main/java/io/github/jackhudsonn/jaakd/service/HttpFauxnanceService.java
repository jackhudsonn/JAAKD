package io.github.jackhudsonn.jaakd.service;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

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
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceHealthResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceSymbolResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceUsageResponse;

@Service
public class HttpFauxnanceService implements FauxnanceService {

    private final RestTemplate fauxnanceRestTemplate;
    private final ObjectMapper objectMapper;
    private final FauxnanceProperties fauxnanceProperties;

    public HttpFauxnanceService(
        RestTemplate fauxnanceRestTemplate,
        ObjectMapper objectMapper,
        FauxnanceProperties fauxnanceProperties
    ) {
        this.fauxnanceRestTemplate = fauxnanceRestTemplate;
        this.objectMapper = objectMapper;
        this.fauxnanceProperties = fauxnanceProperties;
    }

    @Override
    public FauxnanceHealthResponse getHealth() {
        JsonNode json = getJsonWithRetry("/health");
        return toValue(json, FauxnanceHealthResponse.class, "/health");
    }

    @Override
    public FauxnanceUsageResponse getUsage() {
        JsonNode json = getJsonWithRetry("/usage");
        return toValue(json, FauxnanceUsageResponse.class, "/usage");
    }

    @Override
    public FauxnanceSymbolResponse getSymbol(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        JsonNode json = getJsonWithRetry("/symbols/{symbol}", Map.of("symbol", normalizedSymbol));
        return parseSymbolResponse(json);
    }

    @Override
    public FauxnanceCandleResponse getCandles(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        JsonNode json = getJsonWithRetry("/candles/{symbol}", Map.of("symbol", normalizedSymbol));
        return toValue(json, FauxnanceCandleResponse.class, "/candles/{symbol}");
    }

    @Override
    public List<FauxnanceQuoteResponse> getQuotes(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            throw new FauxnanceClientException("At least one symbol is required for /quotes");
        }

        int maxBatchSize = Math.max(1, fauxnanceProperties.getQuotes().getMaxBatchSize());
        if (symbols.size() > maxBatchSize) {
            throw new FauxnanceClientException(
                "Fauxnance quote batch size exceeded: requested " + symbols.size() + ", max " + maxBatchSize
            );
        }

        List<String> normalizedSymbols = symbols.stream()
            .map(this::normalizeSymbol)
            .toList();

        String symbolsQueryValue = String.join(",", normalizedSymbols);
        JsonNode root = getJsonWithRetry(
            "/quotes",
            Map.of(),
            Map.of("symbols", symbolsQueryValue)
        );

        return parseQuotes(root, normalizedSymbols);
    }

    private JsonNode getJsonWithRetry(String path) {
        return getJsonWithRetry(path, Map.of());
    }

    private JsonNode getJsonWithRetry(String path, Map<String, String> uriVariables) {
        return getJsonWithRetry(path, uriVariables, Map.of());
    }

    private JsonNode getJsonWithRetry(String path, Map<String, String> uriVariables, Map<String, String> queryParams) {
        int maxAttempts = Math.max(1, fauxnanceProperties.getRetry().getMaxAttempts());
        long backoffMillis = Math.max(0, fauxnanceProperties.getRetry().getBackoff().toMillis());

        RestClientException lastClientException = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return fetchJson(path, uriVariables, queryParams);
            } catch (RestClientException ex) {
                lastClientException = ex;
                if (attempt == maxAttempts) {
                    break;
                }

                if (backoffMillis > 0) {
                    sleepBackoff(backoffMillis * attempt);
                }
            }
        }

        throw mapRestClientException(path, lastClientException);
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

    private void sleepBackoff(long backoffMillis) {
        try {
            Thread.sleep(backoffMillis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new FauxnanceClientException("Retry backoff interrupted while calling Fauxnance", ex);
        }
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
