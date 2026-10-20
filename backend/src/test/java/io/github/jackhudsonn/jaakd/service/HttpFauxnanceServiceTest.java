package io.github.jackhudsonn.jaakd.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.jackhudsonn.jaakd.config.FauxnanceProperties;
import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceSymbolResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HttpFauxnanceServiceTest {

    @Mock
    private RestTemplate restTemplate;

    private HttpFauxnanceService httpFauxnanceService;

    @BeforeEach
    void setUp() {
        FauxnanceProperties properties = new FauxnanceProperties();
        properties.setBaseUrl("https://example.test/v1");
        properties.getRetry().setMaxAttempts(1);
        properties.getQuotes().setMaxBatchSize(25);

        httpFauxnanceService = new HttpFauxnanceService(
            restTemplate,
            new ObjectMapper(),
            properties
        );
    }

    @Test
    void getQuotes_usesQueryParamAndParsesDataQuotesEnvelope() {
        String json = """
            {
              "data": {
                "quotes": [
                  {
                    "symbol": "AAPL",
                    "source": "cache",
                    "stale": false,
                    "quote": {
                      "symbol": "AAPL",
                      "price": 100.0,
                      "bid": 99.5,
                      "ask": 100.5,
                      "currency": "USD",
                      "asOf": "2026-10-08T10:00:00Z",
                      "marketState": "open"
                    }
                  }
                ]
              }
            }
            """;

        when(restTemplate.exchange(any(URI.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok(json));

        List<FauxnanceQuoteResponse> quotes = httpFauxnanceService.getQuotes(List.of("AAPL"));

        assertEquals(1, quotes.size());
        assertEquals("AAPL", quotes.get(0).symbol());
        assertEquals("USD", quotes.get(0).currency());
        assertEquals("open", quotes.get(0).marketState());

        ArgumentCaptor<URI> uriCaptor = ArgumentCaptor.forClass(URI.class);
        verify(restTemplate).exchange(uriCaptor.capture(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        String requestUri = uriCaptor.getValue().toString();
        assertTrue(requestUri.contains("/quotes"));
        assertTrue(requestUri.contains("symbols="));
        assertTrue(requestUri.contains("AAPL"));
    }

    @Test
    void getQuotes_quoteItemErrorThrowsClientException() {
        String json = """
            {
              "data": {
                "quotes": [
                  {
                    "symbol": "BAD",
                    "error": {
                      "code": "SYMBOL_NOT_FOUND",
                      "message": "Symbol was not recognized."
                    }
                  }
                ]
              }
            }
            """;

        when(restTemplate.exchange(any(URI.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok(json));

        FauxnanceClientException exception = assertThrows(
            FauxnanceClientException.class,
            () -> httpFauxnanceService.getQuotes(List.of("BAD"))
        );

        assertTrue(exception.getMessage().contains("BAD"));
        assertTrue(exception.getMessage().contains("SYMBOL_NOT_FOUND"));
    }

    @Test
    void getSymbol_parsesDataEnvelope() {
        String json = """
            {
              "data": {
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "type": "equity",
                "exchange": "NASDAQ",
                "currency": "USD",
                "description": "Apple",
                "logoUrl": "https://logo"
              }
            }
            """;

        when(restTemplate.exchange(any(URI.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok(json));

        FauxnanceSymbolResponse symbol = httpFauxnanceService.getSymbol("aapl");

        assertEquals("AAPL", symbol.symbol());
        assertEquals("equity", symbol.type());
        assertEquals("NASDAQ", symbol.exchange());
        assertEquals("USD", symbol.currency());
    }

    @Test
    void getCandles_sendsDateRangeAndParsesDataEnvelope() {
        String json = """
            {
              "data": {
                "symbol": "AAPL",
                "interval": "1d",
                "currency": "USD",
                "candles": [
                  {
                    "date": "2026-10-15",
                    "open": 346.95,
                    "high": 347.85,
                    "low": 341.6,
                    "close": 342,
                    "adjclose": 342,
                    "volume": 39605715,
                    "synthetic": false
                  },
                  {
                    "date": "2026-10-16",
                    "open": 346.08,
                    "high": 347.82,
                    "low": 340.46,
                    "close": 343.46,
                    "adjclose": 343.46,
                    "volume": null,
                    "synthetic": true
                  }
                ]
              },
              "meta": { "symbol": "AAPL", "source": "mixed" }
            }
            """;

        when(restTemplate.exchange(any(URI.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok(json));

        FauxnanceCandleResponse response = httpFauxnanceService.getCandles(
            "aapl",
            LocalDate.of(2026, 10, 15),
            LocalDate.of(2026, 10, 16)
        );

        assertEquals("AAPL", response.symbol());
        assertEquals("USD", response.currency());
        assertEquals(2, response.candles().size());

        FauxnanceCandle first = response.candles().get(0);
        assertEquals("2026-10-15", first.date());
        assertEquals(342.0, first.close());
        assertEquals(342.0, first.adjclose());
        assertEquals(Boolean.FALSE, first.synthetic());

        FauxnanceCandle second = response.candles().get(1);
        assertNull(second.volume());
        assertEquals(Boolean.TRUE, second.synthetic());

        ArgumentCaptor<URI> uriCaptor = ArgumentCaptor.forClass(URI.class);
        verify(restTemplate).exchange(uriCaptor.capture(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        String requestUri = uriCaptor.getValue().toString();
        assertTrue(requestUri.endsWith("/candles/AAPL?from=2026-10-15&to=2026-10-16"));
    }

    @Test
    void getCandles_omitsDateRangeWhenNotGiven() {
        String json = """
            { "data": { "symbol": "AAPL", "currency": "USD", "candles": [] } }
            """;

        when(restTemplate.exchange(any(URI.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok(json));

        FauxnanceCandleResponse response = httpFauxnanceService.getCandles("AAPL");

        assertTrue(response.candles().isEmpty());

        ArgumentCaptor<URI> uriCaptor = ArgumentCaptor.forClass(URI.class);
        verify(restTemplate).exchange(uriCaptor.capture(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        assertTrue(uriCaptor.getValue().toString().endsWith("/candles/AAPL"));
    }
}
