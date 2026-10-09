package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentConflictException;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidInstrumentException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceSymbolResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class InstrumentService {

    private static final int MAX_QUOTES_BATCH_SIZE = 25;

    private final InstrumentRepository instrumentRepository;
    private final FauxnanceService fauxnanceService;

    public InstrumentService(InstrumentRepository instrumentRepository, FauxnanceService fauxnanceService) {
        this.instrumentRepository = instrumentRepository;
        this.fauxnanceService = fauxnanceService;
    }

    public List<Instrument> getAllInstruments() {
        return instrumentRepository.findAll();
    }

    public Instrument getInstrumentById(UUID instrumentId) {
        return instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new InstrumentNotFoundException(instrumentId));
    }

    public Instrument getInstrumentByTicker(String ticker) {
        return instrumentRepository.findByTickerIgnoreCase(ticker)
                .orElseThrow(() -> new InstrumentNotFoundException(ticker));
    }

    @Transactional
    public Instrument createInstrument(CreateInstrumentRequest request) {
        // 1. Prevent duplicate tickers
        if (instrumentRepository.existsByTickerIgnoreCase(request.ticker())) {
            throw new InstrumentConflictException(request.ticker());
        }

        // 2. Build entity
        Instrument instrument = new Instrument(
                request.ticker().trim().toUpperCase(),
                request.market().trim(),
                request.name().trim(),
                request.instrumentClass(),
            request.tradingCurrency(),
                request.logoUrl(),
                request.description()
        );

        // 3. Persist entity
        return instrumentRepository.save(instrument);
    }

    @Transactional
    public Instrument updateInstrument(UUID instrumentId, UpdateInstrumentRequest request) {
        // 1. Fetch existing entity
        Instrument instrument = instrumentRepository.findById(instrumentId)
            .orElseThrow(() -> new InstrumentNotFoundException(instrumentId));

        // 2. Update allowed fields only: name, logoUrl, description
        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new InvalidInstrumentException("Instrument name cannot be blank");
            }
            instrument.setName(request.name().trim());
        }

        if (request.logoUrl() != null) {
            instrument.setLogoUrl(request.logoUrl());
        }

        if (request.description() != null) {
            instrument.setDescription(request.description());
        }

        // 3. Save updated entity
        return instrumentRepository.save(instrument);
    }

    @Transactional
    public Instrument createOrUpdateFromExternalData(String ticker) {
        String normalizedTicker = normalizeTicker(ticker);
        FauxnanceSymbolResponse symbolResponse = fauxnanceService.getSymbol(normalizedTicker);

        String responseTicker = normalizeTicker(symbolResponse.symbol());
        String market = requireNonBlank(symbolResponse.exchange(), "Provider returned blank exchange for ticker: " + responseTicker);
        String name = requireNonBlank(symbolResponse.name(), "Provider returned blank name for ticker: " + responseTicker);
        InstrumentClass instrumentClass = parseInstrumentClass(symbolResponse.type(), responseTicker);
        CashCurrency tradingCurrency = parseTradingCurrency(symbolResponse.currency(), responseTicker);

        Instrument instrument = instrumentRepository.findByTickerIgnoreCase(responseTicker)
            .orElseGet(() -> new Instrument(responseTicker, market, name, instrumentClass, tradingCurrency, null, null));

        instrument.setMarket(market);
        instrument.setName(name);
        instrument.setInstrumentClass(instrumentClass);
        instrument.setTradingCurrency(tradingCurrency);
        instrument.setLogoUrl(symbolResponse.logoUrl());
        instrument.setDescription(symbolResponse.description());

        return instrumentRepository.save(instrument);
    }

    public FauxnanceCandleResponse getCandlesFromExternalData(String ticker) {
        String normalizedTicker = normalizeTicker(ticker);
        return fauxnanceService.getCandles(normalizedTicker);
    }

    public FauxnanceQuoteResponse getQuoteByTicker(String ticker) {
        List<FauxnanceQuoteResponse> quotes = getQuotesByTickers(List.of(ticker));
        return quotes.get(0);
    }

    public List<FauxnanceQuoteResponse> getQuotesByTickers(List<String> tickers) {
        if (tickers == null || tickers.isEmpty()) {
            throw new InvalidInstrumentException("At least one ticker is required");
        }

        List<String> normalizedTickers = new ArrayList<>();
        for (int i = 0; i < tickers.size(); i++) {
            String rawTicker = tickers.get(i);
            if (rawTicker == null || rawTicker.isBlank()) {
                continue;
            }

            String[] fragments = rawTicker.split(",");
            for (int j = 0; j < fragments.length; j++) {
                String fragment = fragments[j];
                if (fragment != null && !fragment.isBlank()) {
                    normalizedTickers.add(normalizeTicker(fragment));
                }
            }
        }

        if (normalizedTickers.isEmpty()) {
            throw new InvalidInstrumentException("At least one ticker is required");
        }

        if (normalizedTickers.size() > MAX_QUOTES_BATCH_SIZE) {
            throw new InvalidInstrumentException(
                "A maximum of " + MAX_QUOTES_BATCH_SIZE + " tickers is allowed per quote request"
            );
        }

        return fauxnanceService.getQuotes(normalizedTickers);
    }

    private String normalizeTicker(String ticker) {
        if (ticker == null || ticker.isBlank()) {
            throw new InvalidInstrumentException("Ticker cannot be blank");
        }

        return ticker.trim().toUpperCase();
    }

    private String requireNonBlank(String value, String errorMessage) {
        if (value == null || value.isBlank()) {
            throw new InvalidInstrumentException(errorMessage);
        }

        return value.trim();
    }

    private InstrumentClass parseInstrumentClass(String rawType, String ticker) {
        if (rawType == null || rawType.isBlank()) {
            throw new InvalidInstrumentException("Provider returned blank instrument type for ticker: " + ticker);
        }

        String normalizedType = rawType.trim().toLowerCase();
        return switch (normalizedType) {
            case "equity" -> InstrumentClass.EQUITY;
            case "etf" -> InstrumentClass.ETF;
            case "fx" -> InstrumentClass.FX;
            case "crypto" -> InstrumentClass.CRYPTO;
            default -> throw new InvalidInstrumentException(
                "Provider returned unsupported instrument type '" + rawType + "' for ticker: " + ticker
            );
        };
    }

    private CashCurrency parseTradingCurrency(String rawCurrency, String ticker) {
        try {
            return CashCurrency.fromCode(rawCurrency);
        } catch (IllegalArgumentException ex) {
            throw new InvalidInstrumentException(
                "Provider returned unsupported trading currency '" + rawCurrency + "' for ticker: " + ticker
            );
        }
    }
}
