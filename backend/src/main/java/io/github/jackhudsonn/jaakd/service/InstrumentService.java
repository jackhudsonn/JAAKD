package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.validation.annotation.Validated;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentConflictException;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidInstrumentException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
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

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Service
@Validated
public class InstrumentService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 25;
    private static final int MAX_SIZE = 100;
    private static final int MAX_QUOTES_BATCH_SIZE = 25;

    private final InstrumentRepository instrumentRepository;
    private final PrivilegedAccessService privilegedAccessService;
    private final FauxnanceService fauxnanceService;

    public InstrumentService(
        InstrumentRepository instrumentRepository,
        PrivilegedAccessService privilegedAccessService,
        FauxnanceService fauxnanceService
    ) {
        this.instrumentRepository = instrumentRepository;
        this.privilegedAccessService = privilegedAccessService;
        this.fauxnanceService = fauxnanceService;
    }

    public List<Instrument> getAllInstruments() {
        return getAllInstruments(null, null, null, null);
    }

    public List<Instrument> getAllInstruments(
        InstrumentClass instrumentType,
        String query,
        Integer page,
        Integer size
    ) {
        String normalizedQuery = normalizeQuery(query);
        Sort sort = Sort.by(Sort.Order.asc("ticker"), Sort.Order.asc("instrumentId"));

        if (page == null && size == null) {
            if (instrumentType == null) {
                return instrumentRepository
                    .findByTickerContainingIgnoreCaseOrNameContainingIgnoreCaseOrderByTickerAscInstrumentIdAsc(
                        normalizedQuery,
                        normalizedQuery
                    );
            }

            return instrumentRepository
                .findByInstrumentClassAndTickerContainingIgnoreCaseOrInstrumentClassAndNameContainingIgnoreCaseOrderByTickerAscInstrumentIdAsc(
                    instrumentType,
                    normalizedQuery,
                    instrumentType,
                    normalizedQuery
                );
        }

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize, sort);
        if (instrumentType == null) {
            return instrumentRepository
                .findByTickerContainingIgnoreCaseOrNameContainingIgnoreCase(normalizedQuery, normalizedQuery, pageable)
                .getContent();
        }

        return instrumentRepository
            .findByInstrumentClassAndTickerContainingIgnoreCaseOrInstrumentClassAndNameContainingIgnoreCase(
                instrumentType,
                normalizedQuery,
                instrumentType,
                normalizedQuery,
                pageable
            )
            .getContent();
    }

    public Instrument getInstrumentById(@NotNull UUID instrumentId) {
        return instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new InstrumentNotFoundException(instrumentId));
    }

    public Instrument getInstrumentByTicker(@NotBlank String ticker) {
        return instrumentRepository.findByTickerIgnoreCase(ticker)
                .orElseThrow(() -> new InstrumentNotFoundException(ticker));
    }

    @Transactional
    public Instrument createInstrument(@NotNull CreateInstrumentRequest request) {
        privilegedAccessService.ensureAdmin();

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
    public Instrument updateInstrument(@NotNull UUID instrumentId, @NotNull UpdateInstrumentRequest request) {
        privilegedAccessService.ensureAdmin();

        // 1. Fetch existing entity
        Instrument instrument = instrumentRepository.findById(instrumentId)
            .orElseThrow(() -> new InstrumentNotFoundException(instrumentId));

        // 2. Update allowed fields only: name, logoUrl, description
        if (request.name() != null) {
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

    private String normalizeQuery(String query) {
        if (query == null) {
            return "";
        }

        String trimmed = query.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    @Transactional
    public Instrument createOrUpdateFromExternalData(@NotBlank String ticker) {
        privilegedAccessService.ensureAdmin();

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

    @Transactional
    public Instrument createOrUpdateCryptoFromExternalData(@NotBlank String baseTicker, @NotNull CashCurrency quoteCurrency) {
        if (quoteCurrency == null) {
            throw new InvalidInstrumentException("Quote currency is required");
        }

        String normalizedBaseTicker = normalizeCryptoBaseTicker(baseTicker);
        String providerTicker = "X:" + normalizedBaseTicker + "-" + quoteCurrency.name();
        return createOrUpdateFromExternalData(providerTicker);
    }

    public FauxnanceCandleResponse getCandlesFromExternalData(@NotBlank String ticker) {
        String normalizedTicker = normalizeTicker(ticker);
        return fauxnanceService.getCandles(normalizedTicker);
    }

    public FauxnanceQuoteResponse getQuoteByTicker(@NotBlank String ticker) {
        List<FauxnanceQuoteResponse> quotes = getQuotesByTickers(List.of(ticker));
        return quotes.get(0);
    }

    public List<FauxnanceQuoteResponse> getQuotesByTickers(@NotNull @Size(min = 1, max = MAX_QUOTES_BATCH_SIZE) List<String> tickers) {
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

    private String normalizeCryptoBaseTicker(String baseTicker) {
        String normalized = normalizeTicker(baseTicker);

        if (normalized.startsWith("X:")) {
            normalized = normalized.substring(2);
        }

        int separatorIndex = normalized.indexOf('-');
        if (separatorIndex > 0) {
            normalized = normalized.substring(0, separatorIndex);
        }

        separatorIndex = normalized.indexOf('/');
        if (separatorIndex > 0) {
            normalized = normalized.substring(0, separatorIndex);
        }

        if (normalized.isBlank()) {
            throw new InvalidInstrumentException("Crypto ticker cannot be blank");
        }

        return normalized;
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

    private void validatePaging(int page, int size) {
        if (page < 0) {
            throw new ValidationException("Page must be greater than or equal to 0");
        }

        if (size < 1 || size > MAX_SIZE) {
            throw new ValidationException("Size must be between 1 and 100");
        }
    }

}
