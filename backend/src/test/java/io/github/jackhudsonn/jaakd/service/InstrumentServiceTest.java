package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.InvalidInstrumentException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceSymbolResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InstrumentServiceTest {

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private FauxnanceService fauxnanceService;

    @InjectMocks
    private InstrumentService instrumentService;

    @Test
    void createOrUpdateFromExternalData_mapsEquityTypeAndExchange() {
        when(fauxnanceService.getSymbol("AAPL")).thenReturn(new FauxnanceSymbolResponse(
            "AAPL",
            "Apple Inc.",
            "equity",
            "NASDAQ",
            "USD",
            "Apple description",
            "https://logo"
        ));
        when(instrumentRepository.findByTickerIgnoreCase("AAPL")).thenReturn(Optional.empty());
        when(instrumentRepository.save(any(Instrument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Instrument saved = instrumentService.createOrUpdateFromExternalData("aapl");

        assertEquals("AAPL", saved.getTicker());
        assertEquals("NASDAQ", saved.getMarket());
        assertEquals(InstrumentClass.EQUITY, saved.getInstrumentClass());
        assertEquals(CashCurrency.USD, saved.getTradingCurrency());
    }

    @Test
    void createOrUpdateFromExternalData_mapsFxType() {
        when(fauxnanceService.getSymbol("EURUSD")).thenReturn(new FauxnanceSymbolResponse(
            "EURUSD",
            "Euro Dollar",
            "fx",
            "FX",
            "USD",
            "FX pair",
            null
        ));
        when(instrumentRepository.findByTickerIgnoreCase("EURUSD")).thenReturn(Optional.empty());
        when(instrumentRepository.save(any(Instrument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Instrument saved = instrumentService.createOrUpdateFromExternalData("eurusd");

        assertEquals("EURUSD", saved.getTicker());
        assertEquals("FX", saved.getMarket());
        assertEquals(InstrumentClass.FX, saved.getInstrumentClass());
        assertEquals(CashCurrency.USD, saved.getTradingCurrency());
    }

    @Test
    void createOrUpdateFromExternalData_unsupportedTypeThrows() {
        when(fauxnanceService.getSymbol("US10Y")).thenReturn(new FauxnanceSymbolResponse(
            "US10Y",
            "US Treasury",
            "bond",
            "NYSE",
            "USD",
            "Treasury",
            null
        ));

        assertThrows(
            InvalidInstrumentException.class,
            () -> instrumentService.createOrUpdateFromExternalData("us10y")
        );
    }

    @Test
    void createOrUpdateFromExternalData_unsupportedCurrencyThrows() {
        when(fauxnanceService.getSymbol("AAPL")).thenReturn(new FauxnanceSymbolResponse(
            "AAPL",
            "Apple Inc.",
            "equity",
            "NASDAQ",
            "CAD",
            "Apple",
            "https://logo"
        ));

        assertThrows(
            InvalidInstrumentException.class,
            () -> instrumentService.createOrUpdateFromExternalData("aapl")
        );
    }
}
