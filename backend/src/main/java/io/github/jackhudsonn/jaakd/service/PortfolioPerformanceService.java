package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

// Daily USD value of a portfolio, rebuilt from its EXECUTED order logs and priced with stored daily closes.
// Non-USD cash uses today's rate for every day; today's point uses the real cash and holdings.
// The caller checks ownership first.
@Service
public class PortfolioPerformanceService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioPerformanceService.class);

    // Closes from a week before the first buy, so a weekend buy still has a close to carry forward.
    private static final int PRICE_LOOKBACK_DAYS = 7;
    private static final long CANDLE_TIMEOUT_SECONDS = 5;

    private final OrderLogRepository orderLogRepository;
    private final InstrumentPriceRepository instrumentPriceRepository;
    private final HoldingRepository holdingRepository;
    private final InstrumentRepository instrumentRepository;
    private final FauxnanceService fauxnanceService;
    private final QuoteService quoteService;
    private final HoldingService holdingService;
    private final Clock clock;

    // Closes only change once a day (the nightly PriceHistoryService run), so entries from earlier days are dropped.
    private final Map<CloseKey, NavigableMap<LocalDate, BigDecimal>> closesCache = new ConcurrentHashMap<>();

    public PortfolioPerformanceService(
        OrderLogRepository orderLogRepository,
        InstrumentPriceRepository instrumentPriceRepository,
        HoldingRepository holdingRepository,
        InstrumentRepository instrumentRepository,
        FauxnanceService fauxnanceService,
        QuoteService quoteService,
        HoldingService holdingService,
        Clock clock
    ) {
        this.orderLogRepository = orderLogRepository;
        this.instrumentPriceRepository = instrumentPriceRepository;
        this.holdingRepository = holdingRepository;
        this.instrumentRepository = instrumentRepository;
        this.fauxnanceService = fauxnanceService;
        this.quoteService = quoteService;
        this.holdingService = holdingService;
        this.clock = clock;
    }

    public List<DailyValue> getDailyValues(UUID portfolioId) {
        List<OrderLog> logs = orderLogRepository
            .findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(portfolioId, OrderStatus.EXECUTED)
            .stream().filter(this::countsTowardsValue).toList();
        if (logs.isEmpty()) {
            return List.of();
        }

        LocalDate today = LocalDate.now(clock);
        LocalDate day = logs.get(0).getTimeStamp().toLocalDate();
        if (day.isAfter(today)) {
            day = today;
        }

        Map<UUID, NavigableMap<LocalDate, BigDecimal>> prices = loadPrices(logs, today);
        Balances real = loadRealBalances(portfolioId);
        Map<CashCurrency, BigDecimal> usdRates = loadUsdRates(logs, real);

        Balances replayed = new Balances(new EnumMap<>(CashCurrency.class), new LinkedHashMap<>());
        List<DailyValue> values = new ArrayList<>();
        int next = 0;
        for (; !day.isAfter(today); day = day.plusDays(1)) {
            while (next < logs.size() && !logs.get(next).getTimeStamp().toLocalDate().isAfter(day)) {
                apply(logs.get(next++), replayed);
            }

            Balances balances = replayed;
            if (day.equals(today)) {
                balances = real == null ? replayed : real;
                addLiveQuotes(balances.quantities(), prices, today);
            }
            values.add(new DailyValue(day, valueOn(day, balances, prices, usdRates)));
        }
        return values;
    }

    // Cash moves in every currency. Instrument trades count only when traded in USD, because holdings are priced
    // with USD closes; a non-USD buy is left out, so its cash stays counted at cost.
    private boolean countsTowardsValue(OrderLog orderLog) {
        Instrument instrument = orderLog.getInstrument();
        boolean isCash = instrument.getInstrumentClass() == InstrumentClass.CASH;
        return switch (orderLog.getSide()) {
            case DEPOSIT, WITHDRAW, FX -> isCash && currencyOf(instrument) != null;
            case BUY, SELL -> !isCash && instrument.getTradingCurrency() == CashCurrency.USD;
        };
    }

    private void apply(OrderLog orderLog, Balances balances) {
        Map<CashCurrency, BigDecimal> cash = balances.cash();
        BigDecimal quantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal notional = quantity.multiply(BigDecimal.valueOf(orderLog.getExecutionPrice()));
        UUID instrumentId = orderLog.getInstrument().getInstrumentId();

        switch (orderLog.getSide()) {
            case DEPOSIT -> cash.merge(currencyOf(orderLog.getInstrument()), quantity, BigDecimal::add);
            case WITHDRAW -> cash.merge(currencyOf(orderLog.getInstrument()), quantity.negate(), BigDecimal::add);
            case BUY -> {
                balances.quantities().merge(instrumentId, quantity, BigDecimal::add);
                cash.merge(CashCurrency.USD, notional.negate(), BigDecimal::add);
            }
            case SELL -> {
                balances.quantities().merge(instrumentId, quantity.negate(), BigDecimal::add);
                cash.merge(CashCurrency.USD, notional, BigDecimal::add);
            }
            // Logged on the source cash instrument (quantity = source amount, executionPrice = rate); the target
            // side is only in the metadata HoldingService writes, so a swap without a readable target is skipped.
            case FX -> {
                CashCurrency target = swapTarget(orderLog);
                if (target == null) {
                    log.warn("Skipping FX log {} without a readable target currency", orderLog.getLogOrderID());
                    return;
                }
                BigDecimal targetAmount = notional;
                try {
                    String recorded = metadataValue(orderLog.getMetadata(), "targetAmount");
                    targetAmount = recorded == null ? notional : new BigDecimal(recorded);
                } catch (NumberFormatException ex) {
                    log.warn("FX log {} has an unreadable targetAmount, using quantity times rate", orderLog.getLogOrderID());
                }
                cash.merge(currencyOf(orderLog.getInstrument()), quantity.negate(), BigDecimal::add);
                cash.merge(target, targetAmount, BigDecimal::add);
            }
        }
    }

    private static CashCurrency swapTarget(OrderLog orderLog) {
        return CashCurrency.fromCodeOrNull(metadataValue(orderLog.getMetadata(), "targetCurrency"));
    }

    // First match wins: HoldingService writes its own fields before any user note.
    private static String metadataValue(String metadata, String key) {
        if (metadata != null) {
            for (String part : metadata.split(";")) {
                if (part.startsWith(key + "=")) {
                    return part.substring(key.length() + 1).trim();
                }
            }
        }
        return null;
    }

    private static CashCurrency currencyOf(Instrument cashInstrument) {
        return CashCurrency.fromCodeOrNull(cashInstrument.getTicker());
    }

    private Map<UUID, NavigableMap<LocalDate, BigDecimal>> loadPrices(List<OrderLog> logs, LocalDate today) {
        Map<UUID, Instrument> instruments = new LinkedHashMap<>();
        Map<UUID, LocalDate> firstBuy = new HashMap<>();
        for (OrderLog orderLog : logs) {
            if (orderLog.getInstrument().getInstrumentClass() != InstrumentClass.CASH) {
                instruments.putIfAbsent(orderLog.getInstrument().getInstrumentId(), orderLog.getInstrument());
                firstBuy.putIfAbsent(orderLog.getInstrument().getInstrumentId(), orderLog.getTimeStamp().toLocalDate());
            }
        }

        closesCache.keySet().removeIf(key -> !key.to().equals(today));
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> prices = new HashMap<>();
        Map<UUID, CloseKey> missing = new LinkedHashMap<>();
        for (UUID id : instruments.keySet()) {
            CloseKey key = new CloseKey(id, firstBuy.get(id).minusDays(PRICE_LOOKBACK_DAYS), today);
            NavigableMap<LocalDate, BigDecimal> cached = closesCache.get(key);
            prices.put(id, cached == null ? new TreeMap<>() : new TreeMap<>(cached));
            if (cached == null) {
                missing.put(id, key);
            }
        }

        if (!missing.isEmpty()) {
            addStoredCloses(missing, prices);
            addCandleCloses(missing, instruments, prices);
            // Empty results are not cached, so an instrument that failed is tried again on the next request.
            missing.forEach((id, key) -> {
                if (!prices.get(id).isEmpty()) {
                    closesCache.put(key, Collections.unmodifiableNavigableMap(new TreeMap<>(prices.get(id))));
                }
            });
        }

        for (OrderLog orderLog : logs) {
            NavigableMap<LocalDate, BigDecimal> instrumentPrices = prices.get(orderLog.getInstrument().getInstrumentId());
            if (instrumentPrices != null && orderLog.getExecutionPrice() > 0) {
                instrumentPrices.putIfAbsent(orderLog.getTimeStamp().toLocalDate(), BigDecimal.valueOf(orderLog.getExecutionPrice()));
            }
        }
        return prices;
    }

    private void addStoredCloses(Map<UUID, CloseKey> missing, Map<UUID, NavigableMap<LocalDate, BigDecimal>> prices) {
        LocalDate from = missing.values().stream().map(CloseKey::from).min(LocalDate::compareTo).orElseThrow();
        LocalDate today = missing.values().iterator().next().to();
        try {
            for (InstrumentPrice price : instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(List.copyOf(missing.keySet()), from, today)) {
                if (!price.getPriceDate().isBefore(missing.get(price.getInstrumentId()).from())) {
                    prices.get(price.getInstrumentId()).put(price.getPriceDate(), price.getClose());
                }
            }
        } catch (RuntimeException ex) {
            log.warn("Stored closes unavailable for the performance graph: {}", ex.getMessage());
        }
    }

    private void addCandleCloses(
        Map<UUID, CloseKey> missing,
        Map<UUID, Instrument> instruments,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> prices
    ) {
        Map<UUID, CompletableFuture<FauxnanceCandleResponse>> requests = new LinkedHashMap<>();
        missing.forEach((id, key) -> {
            if (prices.get(id).isEmpty()) {
                try {
                    requests.put(id, fauxnanceService.getCandlesAsync(fauxnanceSymbol(instruments.get(id)), key.from(), key.to())
                        .orTimeout(CANDLE_TIMEOUT_SECONDS, TimeUnit.SECONDS));
                } catch (RuntimeException ex) {
                    requests.put(id, CompletableFuture.failedFuture(ex));
                }
            }
        });

        requests.forEach((id, request) -> {
            try {
                addCandles(prices.get(id), request.join());
            } catch (CompletionException ex) {
                Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                log.warn("Performance candles unavailable for {}: {}", instruments.get(id).getTicker(), cause.toString());
            }
        });
    }

    private static void addCandles(NavigableMap<LocalDate, BigDecimal> closes, FauxnanceCandleResponse response) {
        if (response == null || response.candles() == null) {
            return;
        }
        for (FauxnanceCandle candle : response.candles()) {
            if (candle.date() == null || candle.close() == null) {
                continue;
            }
            try {
                closes.put(LocalDate.parse(candle.date()), BigDecimal.valueOf(candle.close()));
            } catch (DateTimeParseException ex) {
                log.warn("Skipping candle with unreadable date: {}", candle.date());
            }
        }
    }

    // Crypto is stored as "X:BTC-USD"; a bare ticker is mapped to the same Fauxnance symbol.
    private static String fauxnanceSymbol(Instrument instrument) {
        String ticker = instrument.getTicker().trim().toUpperCase();
        if (instrument.getInstrumentClass() == InstrumentClass.CRYPTO && !ticker.startsWith("X:")) {
            return "X:" + ticker + "-USD";
        }
        return FauxnanceSymbols.forInstrument(instrument);
    }

    // Null when there are no holdings rows or they cannot be read, so today keeps the replay.
    private Balances loadRealBalances(UUID portfolioId) {
        try {
            List<Holding> holdings = holdingRepository.findByPortfolioID(portfolioId);
            if (holdings.isEmpty()) {
                return null;
            }

            Map<UUID, Instrument> instruments = new HashMap<>();
            instrumentRepository.findAllById(holdings.stream().map(Holding::getInstrumentID).toList())
                .forEach(instrument -> instruments.put(instrument.getInstrumentId(), instrument));
            Balances balances = new Balances(new EnumMap<>(CashCurrency.class), new LinkedHashMap<>());
            for (Holding holding : holdings) {
                Instrument instrument = instruments.get(holding.getInstrumentID());
                BigDecimal quantity = holding.getCurrentQuantity();
                if (instrument == null || quantity == null || quantity.signum() == 0) {
                    continue;
                }
                if (instrument.getInstrumentClass() == InstrumentClass.CASH && currencyOf(instrument) != null) {
                    balances.cash().put(currencyOf(instrument), quantity);
                } else if (instrument.getInstrumentClass() != InstrumentClass.CASH && instrument.getTradingCurrency() == CashCurrency.USD) {
                    balances.quantities().put(instrument.getInstrumentId(), quantity);
                }
            }
            return balances;
        } catch (RuntimeException ex) {
            log.warn("Current holdings unavailable for the performance graph, today uses the replay: {}", ex.getMessage());
            return null;
        }
    }

    // One lookup per currency per request; a currency whose rate cannot be found is left out of every day.
    private Map<CashCurrency, BigDecimal> loadUsdRates(List<OrderLog> logs, Balances real) {
        Set<CashCurrency> currencies = EnumSet.noneOf(CashCurrency.class);
        for (OrderLog orderLog : logs) {
            if (orderLog.getInstrument().getInstrumentClass() == InstrumentClass.CASH) {
                currencies.add(currencyOf(orderLog.getInstrument()));
            }
            if (orderLog.getSide() == OrderSide.FX && swapTarget(orderLog) != null) {
                currencies.add(swapTarget(orderLog));
            }
        }
        if (real != null) {
            currencies.addAll(real.cash().keySet());
        }

        Map<CashCurrency, BigDecimal> rates = new EnumMap<>(CashCurrency.class);
        rates.put(CashCurrency.USD, BigDecimal.ONE);
        for (CashCurrency currency : currencies) {
            if (currency != CashCurrency.USD) {
                try {
                    rates.put(currency, holdingService.resolveFxRate(currency, CashCurrency.USD));
                } catch (RuntimeException ex) {
                    log.warn("No {} to USD rate for the performance graph, leaving that cash out: {}", currency, ex.getMessage());
                }
            }
        }
        return rates;
    }

    // Today's close is usually not stored yet, so today uses live prices when Fauxnance answers.
    private void addLiveQuotes(Map<UUID, BigDecimal> quantities, Map<UUID, NavigableMap<LocalDate, BigDecimal>> prices, LocalDate today) {
        List<UUID> heldIds = quantities.entrySet().stream().filter(entry -> entry.getValue().signum() != 0).map(Map.Entry::getKey).toList();
        if (heldIds.isEmpty()) {
            return;
        }

        List<MarketQuote> quotes;
        try {
            quotes = quoteService.getQuotes(heldIds);
        } catch (RuntimeException ex) {
            log.warn("Live quotes unavailable for the performance graph, using last closes: {}", ex.getMessage());
            return;
        }
        for (int i = 0; i < heldIds.size() && i < quotes.size(); i++) {
            MarketQuote quote = quotes.get(i);
            if (quote != null && quote.price() != null && quote.price() > 0) {
                prices.computeIfAbsent(heldIds.get(i), id -> new TreeMap<>()).put(today, BigDecimal.valueOf(quote.price()));
            }
        }
    }

    private static BigDecimal valueOn(
        LocalDate day,
        Balances balances,
        Map<UUID, NavigableMap<LocalDate, BigDecimal>> prices,
        Map<CashCurrency, BigDecimal> usdRates
    ) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<CashCurrency, BigDecimal> cash : balances.cash().entrySet()) {
            BigDecimal rate = usdRates.get(cash.getKey());
            if (rate != null) {
                total = total.add(cash.getValue().multiply(rate));
            }
        }
        for (Map.Entry<UUID, BigDecimal> holding : balances.quantities().entrySet()) {
            NavigableMap<LocalDate, BigDecimal> instrumentPrices = prices.get(holding.getKey());
            Map.Entry<LocalDate, BigDecimal> lastKnown = instrumentPrices == null ? null : instrumentPrices.floorEntry(day);
            if (lastKnown != null) {
                total = total.add(holding.getValue().multiply(lastKnown.getValue()));
            }
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    public record DailyValue(LocalDate date, BigDecimal value) {
    }

    private record Balances(Map<CashCurrency, BigDecimal> cash, Map<UUID, BigDecimal> quantities) {
    }

    // to is always today, so a key from an earlier day is stale.
    private record CloseKey(UUID instrumentId, LocalDate from, LocalDate to) {
    }
}
