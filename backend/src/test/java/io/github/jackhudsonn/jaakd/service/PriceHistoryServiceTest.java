package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.config.PriceHistoryProperties;
import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.exception.FauxnanceClientException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandle;
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceCandleResponse;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.TaskExecutor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PriceHistoryServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-20T22:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate TO = LocalDate.of(2026, 10, 20);
    private static final LocalDate FROM = LocalDate.of(2021, 10, 20);
    private static final LocalDateTime FETCHED_AT = LocalDateTime.of(2026, 10, 20, 22, 0);

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private FauxnanceService fauxnanceService;

    @Mock
    private PriceHistoryTxService priceHistoryTxService;

    private final List<Runnable> submittedTasks = new ArrayList<>();
    private PriceHistoryService priceHistoryService;

    @BeforeEach
    void setUp() {
        PriceHistoryProperties properties = new PriceHistoryProperties();
        properties.setLookback(Period.ofYears(5));
        properties.setRequestDelay(Duration.ZERO);

        // Holds background work until the test runs it, so the in-progress guard can be observed.
        TaskExecutor capturingExecutor = submittedTasks::add;

        priceHistoryService = new PriceHistoryService(
            instrumentRepository,
            fauxnanceService,
            priceHistoryTxService,
            properties,
            CLOCK,
            capturingExecutor
        );
    }

    @Test
    void refresh_skipsCashAndUsesFauxnanceSymbols() {
        Instrument equity = instrument("aapl", InstrumentClass.EQUITY, CashCurrency.USD);
        Instrument fx = instrument("EURUSD", InstrumentClass.FX, CashCurrency.USD);
        Instrument cash = instrument("USD", InstrumentClass.CASH, CashCurrency.USD);
        List<FauxnanceCandle> candles = List.of(candle("2026-10-20"));

        when(instrumentRepository.findAll()).thenReturn(List.of(equity, fx, cash));
        when(fauxnanceService.getCandles("AAPL", FROM, TO)).thenReturn(new FauxnanceCandleResponse("AAPL", "USD", candles));
        when(fauxnanceService.getCandles("FX:EURUSD", FROM, TO)).thenReturn(new FauxnanceCandleResponse("FX:EURUSD", "USD", candles));
        when(priceHistoryTxService.writeCandles(any(), anyString(), anyList(), eq(FROM), eq(TO), eq(FETCHED_AT))).thenReturn(1);

        PriceHistoryService.PriceRefreshResult result = priceHistoryService.refresh();

        assertEquals(new PriceHistoryService.PriceRefreshResult(2, 0, 2), result);
        verify(fauxnanceService, never()).getCandles(eq("USD"), any(), any());
        verify(priceHistoryTxService).writeCandles(equity.getInstrumentId(), "USD", candles, FROM, TO, FETCHED_AT);
        verify(priceHistoryTxService).writeCandles(fx.getInstrumentId(), "USD", candles, FROM, TO, FETCHED_AT);
    }

    @Test
    void refresh_continuesAfterAFailedInstrument() {
        Instrument failing = instrument("BAD", InstrumentClass.EQUITY, CashCurrency.USD);
        Instrument working = instrument("MSFT", InstrumentClass.EQUITY, CashCurrency.USD);

        when(instrumentRepository.findAll()).thenReturn(List.of(failing, working));
        when(fauxnanceService.getCandles("BAD", FROM, TO)).thenThrow(new FauxnanceClientException("SYMBOL_NOT_FOUND"));
        when(fauxnanceService.getCandles("MSFT", FROM, TO)).thenReturn(new FauxnanceCandleResponse("MSFT", "USD", List.of()));
        when(priceHistoryTxService.writeCandles(working.getInstrumentId(), "USD", List.of(), FROM, TO, FETCHED_AT)).thenReturn(0);

        PriceHistoryService.PriceRefreshResult result = priceHistoryService.refresh();

        assertEquals(new PriceHistoryService.PriceRefreshResult(1, 1, 0), result);
    }

    @Test
    void refresh_fallsBackToTradingCurrencyWhenResponseHasNone() {
        Instrument rupeeListed = instrument("RELIANCE", InstrumentClass.EQUITY, CashCurrency.INR);

        when(instrumentRepository.findAll()).thenReturn(List.of(rupeeListed));
        when(fauxnanceService.getCandles("RELIANCE", FROM, TO)).thenReturn(new FauxnanceCandleResponse("RELIANCE", null, null));

        priceHistoryService.refresh();

        verify(priceHistoryTxService).writeCandles(rupeeListed.getInstrumentId(), "INR", List.of(), FROM, TO, FETCHED_AT);
    }

    @Test
    void startRefresh_rejectsASecondRunUntilTheFirstFinishes() {
        when(instrumentRepository.findAll()).thenReturn(List.of());

        priceHistoryService.startRefresh();

        ConflictException conflict = assertThrows(ConflictException.class, () -> priceHistoryService.startRefresh());
        assertEquals("A price history refresh is already running", conflict.getMessage());

        submittedTasks.get(0).run();

        assertDoesNotThrow(() -> priceHistoryService.startRefresh());
    }

    @Test
    void scheduledRefresh_skipsWhileAnAdminRefreshIsRunning() {
        priceHistoryService.startRefresh();

        priceHistoryService.scheduledRefresh();

        verify(instrumentRepository, never()).findAll();
    }

    private static Instrument instrument(String ticker, InstrumentClass instrumentClass, CashCurrency currency) {
        Instrument instrument = new Instrument(ticker, "TEST", ticker + " name", instrumentClass, currency);
        ReflectionTestUtils.setField(instrument, "instrumentId", UUID.randomUUID());
        return instrument;
    }

    private static FauxnanceCandle candle(String date) {
        return new FauxnanceCandle(date, 10.0, 11.0, 9.0, 10.5, 10.5, 1000.0, false);
    }
}
