package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.validation.annotation.Validated;
import org.springframework.dao.DataAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.InstrumentCandleResponse;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentConflictException;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidInstrumentException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.security.RequiresUserType;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceQuoteResponse;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceSymbolResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.math.BigDecimal;
import java.util.Map;
import java.util.TreeMap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Service
@Validated
public class InstrumentService {

    private static final Logger log = LoggerFactory.getLogger(InstrumentService.class);

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 25;
    private static final int MAX_SIZE = 100;
    private static final int MAX_QUOTES_BATCH_SIZE = 25;
    private static final int DEFAULT_CANDLE_SERIES_YEARS = 1;
    private static final int MAX_CANDLE_SERIES_YEARS = 5;
    private static final int MAX_CACHED_CANDLE_GAP_DAYS = 7;

    private final InstrumentRepository instrumentRepository;
    private final InstrumentPriceRepository instrumentPriceRepository;
    private final FauxnanceService fauxnanceService;
    private final PriceHistoryTxService priceHistoryTxService;
    private final Clock clock;

    public InstrumentService(
        InstrumentRepository instrumentRepository,
        InstrumentPriceRepository instrumentPriceRepository,
        FauxnanceService fauxnanceService,
        PriceHistoryTxService priceHistoryTxService,
        Clock clock
    ) {
        this.instrumentRepository = instrumentRepository;
        this.instrumentPriceRepository = instrumentPriceRepository;
        this.fauxnanceService = fauxnanceService;
        this.priceHistoryTxService = priceHistoryTxService;
        this.clock = clock;
    }

    public List<InstrumentCandleResponse> getCandles(
        @NotNull UUID instrumentId,
        LocalDate from,
        LocalDate to
    ) {
        Instrument instrument = getInstrumentById(instrumentId);

        LocalDate resolvedTo = to == null ? LocalDate.now(clock) : to;
        LocalDate resolvedFrom = from == null ? resolvedTo.minusYears(DEFAULT_CANDLE_SERIES_YEARS) : from;
        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new InvalidInstrumentException("from must not be after to");
        }
        if (resolvedFrom.isBefore(resolvedTo.minusYears(MAX_CANDLE_SERIES_YEARS))) {
            throw new InvalidInstrumentException("Candle series range must not exceed five years");
        }

        List<InstrumentPrice> cachedPrices = instrumentPriceRepository
            .findByInstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(instrumentId, resolvedFrom, resolvedTo)
            .stream()
            .filter(price -> !price.isSynthetic())
            .toList();

        if (instrument.getInstrumentClass() == InstrumentClass.CASH || hasCompleteCandleCoverage(
            cachedPrices,
            resolvedFrom,
            resolvedTo
        )) {
            return toCandleResponses(cachedPrices);
        }

        Map<LocalDate, InstrumentCandleResponse> candlesByDate = new TreeMap<>();
        toCandleResponses(cachedPrices).forEach(candle -> candlesByDate.put(candle.date(), candle));

        FauxnanceCandleResponse externalResponse;
        try {
            externalResponse = fauxnanceService.getCandles(
                FauxnanceSymbols.forInstrument(instrument),
                resolvedFrom,
                resolvedTo
            );
        } catch (RuntimeException exception) {
            log.warn("Fauxnance candle fallback failed for {}: {}", instrument.getTicker(), exception.getMessage());
            return List.copyOf(candlesByDate.values());
        }

        List<FauxnanceCandle> externalCandles = externalResponse == null || externalResponse.candles() == null
            ? List.of()
            : externalResponse.candles();
        String currency = externalResponse == null || externalResponse.currency() == null
                || externalResponse.currency().isBlank()
            ? instrument.getTradingCurrency().name()
            : externalResponse.currency().trim().toUpperCase();

        if (!externalCandles.isEmpty()) {
            try {
                priceHistoryTxService.writeCandles(
                    instrumentId,
                    currency,
                    externalCandles,
                    resolvedFrom,
                    resolvedTo,
                    LocalDateTime.now(clock)
                );
            } catch (DataAccessException exception) {
                log.warn("Could not cache Fauxnance candles for {}: {}", instrument.getTicker(), exception.getMessage());
            }
        }

        for (FauxnanceCandle candle : externalCandles) {
            InstrumentCandleResponse response = toCandleResponse(candle, currency, resolvedFrom, resolvedTo);
            if (response != null) {
                candlesByDate.putIfAbsent(response.date(), response);
            }
        }

        return List.copyOf(candlesByDate.values());
    }

    private static boolean hasCompleteCandleCoverage(
        List<InstrumentPrice> prices,
        LocalDate from,
        LocalDate to
    ) {
        if (prices.isEmpty()) {
            return false;
        }

        if (prices.get(0).getPriceDate().isAfter(from.plusDays(MAX_CACHED_CANDLE_GAP_DAYS))
            || prices.get(prices.size() - 1).getPriceDate().isBefore(to.minusDays(MAX_CACHED_CANDLE_GAP_DAYS))) {
            return false;
        }

        for (int index = 1; index < prices.size(); index++) {
            if (prices.get(index).getPriceDate().isAfter(
                prices.get(index - 1).getPriceDate().plusDays(MAX_CACHED_CANDLE_GAP_DAYS)
            )) {
                return false;
            }
        }

        return true;
    }

    private static List<InstrumentCandleResponse> toCandleResponses(List<InstrumentPrice> prices) {
        return prices.stream()
            .map(price -> new InstrumentCandleResponse(
                price.getPriceDate(),
                price.getOpen(),
                price.getHigh(),
                price.getLow(),
                price.getClose(),
                price.getVolume(),
                price.getCurrency()
            ))
            .toList();
    }

    private static InstrumentCandleResponse toCandleResponse(
        FauxnanceCandle candle,
        String currency,
        LocalDate from,
        LocalDate to
    ) {
        if (candle == null || Boolean.TRUE.equals(candle.synthetic())
            || candle.date() == null || candle.open() == null || candle.high() == null
            || candle.low() == null || candle.close() == null) {
            return null;
        }

        try {
            LocalDate date = LocalDate.parse(candle.date());
            if (date.isBefore(from) || date.isAfter(to)) {
                return null;
            }
            return new InstrumentCandleResponse(
                date,
                BigDecimal.valueOf(candle.open()),
                BigDecimal.valueOf(candle.high()),
                BigDecimal.valueOf(candle.low()),
                BigDecimal.valueOf(candle.close()),
                candle.volume() == null ? null : candle.volume().longValue(),
                currency
            );
        } catch (DateTimeParseException exception) {
            return null;
        }
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
            return instrumentRepository.findBySearchQueryAndOptionalInstrumentClass(normalizedQuery, instrumentType);
        }

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize, sort);
        return instrumentRepository
            .findBySearchQueryAndOptionalInstrumentClass(normalizedQuery, instrumentType, pageable)
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
    @RequiresUserType(UserType.ADMIN)
    public Instrument createInstrument(@NotNull CreateInstrumentRequest request) {
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
    @RequiresUserType(UserType.ADMIN)
    public Instrument updateInstrument(@NotNull UUID instrumentId, @NotNull UpdateInstrumentRequest request) {
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
    @RequiresUserType(UserType.ADMIN)
    public Instrument createOrUpdateFromExternalData(@NotBlank String ticker) {
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

    // Annotated as well: its internal call to createOrUpdateFromExternalData bypasses the proxy.
    @Transactional
    @RequiresUserType(UserType.ADMIN)
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
