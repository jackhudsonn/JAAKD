package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FauxnanceQuoteServiceTest {

    @Mock
    private FauxnanceService fauxnanceService;

    @Mock
    private InstrumentRepository instrumentRepository;

    @InjectMocks
    private FauxnanceQuoteService fauxnanceQuoteService;

    @Test
    void getExecutionPrice_buyUsesAskOnly() throws Exception {
        UUID instrumentId = UUID.randomUUID();
        Instrument instrument = buildInstrument(instrumentId, "AAPL");

        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));
        when(fauxnanceService.getQuotes(List.of("AAPL")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("AAPL", 100.0, 99.0, 101.0, "USD", "2026-10-08T10:00:00Z", "open")));

        Double price = fauxnanceQuoteService.getExecutionPrice(instrumentId, OrderSide.BUY);
        assertEquals(101.0, price);
    }

    @Test
    void getExecutionPrice_buyDoesNotFallbackWhenAskMissing() throws Exception {
        UUID instrumentId = UUID.randomUUID();
        Instrument instrument = buildInstrument(instrumentId, "AAPL");

        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));
        when(fauxnanceService.getQuotes(List.of("AAPL")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("AAPL", 100.0, 99.0, null, "USD", "2026-10-08T10:00:00Z", "open")));

        Double price = fauxnanceQuoteService.getExecutionPrice(instrumentId, OrderSide.BUY);
        assertNull(price);
    }

    @Test
    void getExecutionPrice_sellUsesBidOnly() throws Exception {
        UUID instrumentId = UUID.randomUUID();
        Instrument instrument = buildInstrument(instrumentId, "MSFT");

        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));
        when(fauxnanceService.getQuotes(List.of("MSFT")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("MSFT", 200.0, 199.5, 200.5, "USD", "2026-10-08T10:00:00Z", "open")));

        Double price = fauxnanceQuoteService.getExecutionPrice(instrumentId, OrderSide.SELL);
        assertEquals(199.5, price);
    }

    @Test
    void getExecutionPrice_sellDoesNotFallbackWhenBidMissing() throws Exception {
        UUID instrumentId = UUID.randomUUID();
        Instrument instrument = buildInstrument(instrumentId, "MSFT");

        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));
        when(fauxnanceService.getQuotes(List.of("MSFT")))
            .thenReturn(List.of(new FauxnanceQuoteResponse("MSFT", 200.0, null, 200.5, "USD", "2026-10-08T10:00:00Z", "open")));

        Double price = fauxnanceQuoteService.getExecutionPrice(instrumentId, OrderSide.SELL);
        assertNull(price);
    }

    private Instrument buildInstrument(UUID instrumentId, String ticker) throws Exception {
        Instrument instrument = new Instrument(ticker, "NASDAQ", ticker + " Inc.", InstrumentClass.EQUITY);
        Field instrumentIdField = Instrument.class.getDeclaredField("instrumentId");
        instrumentIdField.setAccessible(true);
        instrumentIdField.set(instrument, instrumentId);
        return instrument;
    }
}
