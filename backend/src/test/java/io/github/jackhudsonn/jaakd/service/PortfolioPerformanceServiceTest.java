package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.InstrumentPriceRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioPerformanceServiceTest {

    // Tuesday 20 Oct 2026; the 17th and 18th are a weekend.
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-20T12:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 10, 16);
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 19);
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 20);

    @Mock private OrderLogRepository orderLogRepository;
    @Mock private InstrumentPriceRepository instrumentPriceRepository;
    @Mock private FauxnanceService fauxnanceService;
    @Mock private QuoteService quoteService;

    private PortfolioPerformanceService service;
    private final UUID portfolioId = UUID.randomUUID();
    private final Portfolio portfolio = new Portfolio(new Profile(BigDecimal.ZERO));
    private final Instrument usdCash = instrument("USD", InstrumentClass.CASH, CashCurrency.USD);
    private final Instrument apple = instrument("AAPL", InstrumentClass.EQUITY, CashCurrency.USD);

    @BeforeEach
    void setUp() {
        service = serviceWithClock(CLOCK);
        ReflectionTestUtils.setField(portfolio, "portfolioId", portfolioId);
    }

    @Test
    void returnsNoPointsWhenNothingWasExecuted() {
        givenLogs();
        assertEquals(List.of(), service.getDailyValues(portfolioId));
    }

    @Test
    void countsOnlyUsdCashAndUsdInstruments() {
        givenLogs(
            log(usdCash, OrderSide.DEPOSIT, 1000, 0, MONDAY),
            log(instrument("EUR", InstrumentClass.CASH, CashCurrency.EUR), OrderSide.DEPOSIT, 500, 0, MONDAY),
            log(instrument("TCS.NS", InstrumentClass.EQUITY, CashCurrency.INR), OrderSide.BUY, 1, 3000, TODAY),
            log(usdCash, OrderSide.FX, 200, 0.9, TODAY)
        );

        assertValues(MONDAY, "1000.00", "1000.00");
        verifyNoInteractions(instrumentPriceRepository, fauxnanceService, quoteService);
    }

    @Test
    void valuesABuyAtEachCloseAndTodayAtTheLiveQuote() {
        givenLogs(log(usdCash, OrderSide.DEPOSIT, 1000, 0, MONDAY), log(apple, OrderSide.BUY, 5, 100, MONDAY));
        givenCloses(close(apple, MONDAY, "110"), close(apple, TODAY, "120"));
        when(quoteService.getQuotes(List.of(apple.getInstrumentId())))
            .thenReturn(List.of(new MarketQuote("AAPL", 130.0, 130.0, 130.0, "USD", null, "open")));

        // Cash 500 plus 5 shares at 110, then at the live 130 rather than the stored 120.
        assertValues(MONDAY, "1050.00", "1150.00");
    }

    @Test
    void sellMovesValueIntoCashAndFailedQuotesFallBackToTheClose() {
        givenLogs(
            log(usdCash, OrderSide.DEPOSIT, 1000, 0, MONDAY),
            log(apple, OrderSide.BUY, 5, 100, MONDAY),
            log(apple, OrderSide.SELL, 2, 120, TODAY)
        );
        givenCloses(close(apple, MONDAY, "100"), close(apple, TODAY, "120"));
        when(quoteService.getQuotes(anyList())).thenThrow(new FauxnanceClientException("down"));

        // Today: cash 740 plus 3 shares at the 120 close.
        assertValues(MONDAY, "1000.00", "1100.00");
    }

    @Test
    void carriesTheLastCloseForwardOverTheWeekend() {
        givenLogs(log(usdCash, OrderSide.DEPOSIT, 1000, 0, FRIDAY), log(apple, OrderSide.BUY, 5, 100, FRIDAY));
        givenCloses(close(apple, FRIDAY, "100"), close(apple, MONDAY, "104"));
        when(quoteService.getQuotes(anyList())).thenReturn(List.of());

        assertValues(FRIDAY, "1000.00", "1000.00", "1000.00", "1020.00", "1020.00");
    }

    @Test
    void loadsClosesInOneQueryOnlyForTheDaysInstrumentsWereHeld() {
        Instrument microsoft = instrument("MSFT", InstrumentClass.EQUITY, CashCurrency.USD);
        givenLogs(
            log(usdCash, OrderSide.DEPOSIT, 1000, 0, FRIDAY),
            log(apple, OrderSide.BUY, 1, 100, FRIDAY),
            log(microsoft, OrderSide.BUY, 1, 200, FRIDAY),
            log(apple, OrderSide.SELL, 1, 100, MONDAY),
            log(microsoft, OrderSide.SELL, 1, 200, MONDAY)
        );
        givenCloses();

        service.getDailyValues(portfolioId);

        verify(instrumentPriceRepository).findByInstrumentIdInAndPriceDateBetween(
            List.of(apple.getInstrumentId(), microsoft.getInstrumentId()), FRIDAY.minusDays(7), MONDAY);
        verifyNoInteractions(quoteService);
    }

    @Test
    void fetchesCandlesForMissingClosesAndSkipsASymbolThatTimesOut() {
        Instrument bitcoin = instrument("BTC", InstrumentClass.CRYPTO, CashCurrency.USD);
        givenLogs(
            log(usdCash, OrderSide.DEPOSIT, 1000, 0, MONDAY),
            log(apple, OrderSide.BUY, 1, 100, MONDAY),
            log(bitcoin, OrderSide.BUY, 1, 500, MONDAY)
        );
        givenCloses();
        when(fauxnanceService.getCandlesAsync(eq("AAPL"), any(), any()))
            .thenReturn(CompletableFuture.failedFuture(new TimeoutException()));
        when(fauxnanceService.getCandlesAsync(eq("X:BTC-USD"), any(), any())).thenReturn(CompletableFuture.completedFuture(
            new FauxnanceCandleResponse("X:BTC-USD", "USD", List.of(candle("2026-10-19", 550.0), candle("2026-10-20", 600.0)))));
        when(quoteService.getQuotes(anyList())).thenReturn(List.of());

        // Cash 400; Apple stays at its 100 fill price, Bitcoin follows its candles.
        assertValues(MONDAY, "1050.00", "1100.00");
    }

    @Test
    void cachesClosesForTheDayAndReloadsOnTheNextDay() {
        Clock clock = mock(Clock.class);
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        when(clock.instant()).thenReturn(
            Instant.parse("2026-10-20T09:00:00Z"), Instant.parse("2026-10-20T10:00:00Z"), Instant.parse("2026-10-21T09:00:00Z"));
        PortfolioPerformanceService cachingService = serviceWithClock(clock);
        // Sold out on Monday, so the price window (the cache key) is the same on both days.
        givenLogs(
            log(usdCash, OrderSide.DEPOSIT, 1000, 0, FRIDAY),
            log(apple, OrderSide.BUY, 5, 100, FRIDAY),
            log(apple, OrderSide.SELL, 5, 110, MONDAY)
        );
        givenCloses(close(apple, FRIDAY, "100"));

        for (int i = 0; i < 3; i++) {
            cachingService.getDailyValues(portfolioId);
        }

        verify(instrumentPriceRepository, times(2)).findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any());
    }

    private PortfolioPerformanceService serviceWithClock(Clock clock) {
        return new PortfolioPerformanceService(orderLogRepository, instrumentPriceRepository, fauxnanceService, quoteService, clock);
    }

    private void givenLogs(OrderLog... logs) {
        when(orderLogRepository.findByPortfolioPortfolioIdAndStatusOrderByTimestampAsc(portfolioId, OrderStatus.EXECUTED))
            .thenReturn(List.of(logs));
    }

    private void givenCloses(InstrumentPrice... prices) {
        when(instrumentPriceRepository.findByInstrumentIdInAndPriceDateBetween(anyCollection(), any(), any()))
            .thenReturn(List.of(prices));
    }

    private void assertValues(LocalDate firstDay, String... expected) {
        List<PortfolioPerformanceService.DailyValue> values = service.getDailyValues(portfolioId);
        assertEquals(List.of(expected), values.stream().map(value -> value.value().toPlainString()).toList());
        assertEquals(firstDay, values.get(0).date());
        assertEquals(TODAY, values.get(values.size() - 1).date());
    }

    private OrderLog log(Instrument instrument, OrderSide side, double quantity, double price, LocalDate day) {
        OrderLog orderLog = new OrderLog(UUID.randomUUID(), portfolio, instrument, side, quantity);
        orderLog.setStatus(OrderStatus.EXECUTED);
        orderLog.setExecutionPrice(price);
        orderLog.setTimeStamp(LocalDateTime.of(day, LocalTime.NOON));
        return orderLog;
    }

    private static Instrument instrument(String ticker, InstrumentClass instrumentClass, CashCurrency currency) {
        Instrument instrument = new Instrument(ticker, "TEST", ticker, instrumentClass, currency);
        ReflectionTestUtils.setField(instrument, "instrumentId", UUID.randomUUID());
        return instrument;
    }

    private static InstrumentPrice close(Instrument instrument, LocalDate day, String close) {
        InstrumentPrice price = new InstrumentPrice(instrument.getInstrumentId(), day);
        BigDecimal value = new BigDecimal(close);
        price.apply(value, value, value, value, value, 0L, "USD", false, day.atStartOfDay());
        return price;
    }

    private static FauxnanceCandle candle(String date, double close) {
        return new FauxnanceCandle(date, close, close, close, close, close, 0.0, false);
    }
}
