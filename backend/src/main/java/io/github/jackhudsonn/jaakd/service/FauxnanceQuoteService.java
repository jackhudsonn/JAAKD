package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Primary
public class FauxnanceQuoteService implements QuoteService {

    private final FauxnanceService fauxnanceService;
    private final InstrumentRepository instrumentRepository;

    public FauxnanceQuoteService(
        FauxnanceService fauxnanceService,
        InstrumentRepository instrumentRepository
    ) {
        this.fauxnanceService = fauxnanceService;
        this.instrumentRepository = instrumentRepository;
    }

    @Override
    public Double getExecutionPrice(UUID instrumentId, OrderSide side) {
        MarketQuote quote = getQuote(instrumentId);

        if (side == OrderSide.BUY) {
            return chooseBuyPrice(quote);
        }

        if (side == OrderSide.SELL) {
            return chooseSellPrice(quote);
        }

        return chooseNeutralPrice(quote);
    }

    @Override
    public MarketQuote getQuote(UUID instrumentId) {
        String symbol = resolveSymbol(instrumentId);
        List<FauxnanceQuoteResponse> quotes = fauxnanceService.getQuotes(List.of(symbol));

        if (quotes.isEmpty()) {
            throw new FauxnanceClientException("No quote returned for symbol: " + symbol);
        }

        FauxnanceQuoteResponse response = quotes.get(0);
        return normalizeResponse(response, symbol);
    }

    @Override
    public List<MarketQuote> getQuotes(List<UUID> instrumentIds) {
        if (instrumentIds == null || instrumentIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, String> symbolByInstrumentId = new LinkedHashMap<>();
        for (UUID instrumentId : instrumentIds) {
            symbolByInstrumentId.put(instrumentId, resolveSymbol(instrumentId));
        }

        List<String> symbols = new ArrayList<>(symbolByInstrumentId.values());
        List<FauxnanceQuoteResponse> responses = fauxnanceService.getQuotes(symbols);

        Map<String, FauxnanceQuoteResponse> responseBySymbol = new LinkedHashMap<>();
        for (FauxnanceQuoteResponse response : responses) {
            if (response.symbol() != null) {
                responseBySymbol.put(response.symbol().toUpperCase(), response);
            }
        }

        List<MarketQuote> marketQuotes = new ArrayList<>();
        for (String symbol : symbols) {
            FauxnanceQuoteResponse response = responseBySymbol.get(symbol.toUpperCase());
            if (response == null) {
                throw new FauxnanceClientException("No quote returned for symbol: " + symbol);
            }
            marketQuotes.add(normalizeResponse(response, symbol));
        }

        return marketQuotes;
    }

    private String resolveSymbol(UUID instrumentId) {
        return instrumentRepository.findById(instrumentId)
            .orElseThrow(() -> new InstrumentNotFoundException(instrumentId))
            .getTicker()
            .trim()
            .toUpperCase();
    }

    private MarketQuote normalizeResponse(FauxnanceQuoteResponse response, String fallbackSymbol) {
        String symbol = response.symbol();
        if (symbol == null || symbol.isBlank()) {
            symbol = fallbackSymbol;
        }

        return new MarketQuote(
            symbol.toUpperCase(),
            response.price(),
            response.bid(),
            response.ask(),
            response.currency(),
            response.asOf(),
            response.marketState()
        );
    }

    private Double chooseBuyPrice(MarketQuote quote) {
        if (quote.ask() != null && quote.ask() > 0) {
            return quote.ask();
        }
        return null;
    }

    private Double chooseSellPrice(MarketQuote quote) {
        if (quote.bid() != null && quote.bid() > 0) {
            return quote.bid();
        }
        return null;
    }

    private Double chooseNeutralPrice(MarketQuote quote) {
        if (quote.price() != null && quote.price() > 0) {
            return quote.price();
        }

        if (quote.bid() != null && quote.bid() > 0) {
            return quote.bid();
        }

        if (quote.ask() != null && quote.ask() > 0) {
            return quote.ask();
        }

        return null;
    }
}
