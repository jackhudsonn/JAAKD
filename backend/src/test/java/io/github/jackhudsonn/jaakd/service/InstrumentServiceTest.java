package io.github.jackhudsonn.jaakd.service;

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
import io.github.jackhudsonn.jaakd.model.fauxnance.FauxnanceSymbolResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
    void getAllInstruments_doesNotRequireAdmin() {
        when(instrumentRepository.findBySearchQueryAndOptionalInstrumentClass("", null))
            .thenReturn(List.of());

        instrumentService.getAllInstruments();
    }

    @Test
    void getAllInstruments_filterByQueryOnly_usesUnpagedFilteredSearch() {
        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY, CashCurrency.USD);
        when(instrumentRepository.findBySearchQueryAndOptionalInstrumentClass("app", null))
            .thenReturn(List.of(instrument));

        List<Instrument> result = instrumentService.getAllInstruments(null, " app ", null, null);

        assertEquals(1, result.size());
        verify(instrumentRepository, times(1))
            .findBySearchQueryAndOptionalInstrumentClass("app", null);
    }

    @Test
    void getAllInstruments_filterByInstrumentTypeOnly_usesUnpagedFilteredSearch() {
        when(instrumentRepository.findBySearchQueryAndOptionalInstrumentClass("", InstrumentClass.ETF))
            .thenReturn(List.of());

        instrumentService.getAllInstruments(InstrumentClass.ETF, null, null, null);

        verify(instrumentRepository, times(1))
            .findBySearchQueryAndOptionalInstrumentClass("", InstrumentClass.ETF);
    }

    @Test
    void getAllInstruments_filterByTypeAndQuery_usesUnpagedFilteredSearch() {
        when(instrumentRepository.findBySearchQueryAndOptionalInstrumentClass("aap", InstrumentClass.EQUITY))
            .thenReturn(List.of());

        instrumentService.getAllInstruments(InstrumentClass.EQUITY, "aap", null, null);

        verify(instrumentRepository, times(1))
            .findBySearchQueryAndOptionalInstrumentClass("aap", InstrumentClass.EQUITY);
    }

    @Test
    void getAllInstruments_emptyResults_returnsEmptyList() {
        when(instrumentRepository.findBySearchQueryAndOptionalInstrumentClass("missing", null))
            .thenReturn(List.of());

        List<Instrument> result = instrumentService.getAllInstruments(null, "missing", null, null);

        assertEquals(0, result.size());
    }

    @Test
    void getAllInstruments_withPaging_usesPageRequestDefaults() {
        List<Instrument> content = List.of(new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY, CashCurrency.USD));
        Page<Instrument> page = new PageImpl<>(content);
        when(instrumentRepository.findBySearchQueryAndOptionalInstrumentClass(
            org.mockito.ArgumentMatchers.eq(""),
            org.mockito.ArgumentMatchers.isNull(),
            org.mockito.ArgumentMatchers.any(Pageable.class)
        ))
            .thenReturn(page);

        List<Instrument> result = instrumentService.getAllInstruments(null, null, 0, null);

        assertEquals(1, result.size());

        org.mockito.ArgumentCaptor<Pageable> pageableCaptor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(instrumentRepository, times(1)).findBySearchQueryAndOptionalInstrumentClass(
            org.mockito.ArgumentMatchers.eq(""),
            org.mockito.ArgumentMatchers.isNull(),
            pageableCaptor.capture()
        );
        assertEquals(
            PageRequest.of(0, 25, Sort.by(Sort.Order.asc("ticker"), Sort.Order.asc("instrumentId"))),
            pageableCaptor.getValue()
        );
    }

    @Test
    void getAllInstruments_invalidPage_throwsValidationException() {
        assertThrows(
            ValidationException.class,
            () -> instrumentService.getAllInstruments(null, null, -1, 25)
        );
    }

    @Test
    void getAllInstruments_invalidSize_throwsValidationException() {
        assertThrows(
            ValidationException.class,
            () -> instrumentService.getAllInstruments(null, null, 0, 101)
        );
    }

    @Test
    void getInstrumentById_doesNotRequireAdmin() {
        UUID instrumentId = UUID.randomUUID();
        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY, CashCurrency.USD);
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));

        instrumentService.getInstrumentById(instrumentId);
    }

    @Test
    void getInstrumentByTicker_doesNotRequireAdmin() {
        Instrument instrument = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY, CashCurrency.USD);
        when(instrumentRepository.findByTickerIgnoreCase("AAPL")).thenReturn(Optional.of(instrument));

        instrumentService.getInstrumentByTicker("AAPL");
    }

    @Test
    void createInstrument_requiresAdminAndPersists() {
        CreateInstrumentRequest request = new CreateInstrumentRequest(
            "aapl",
            "NASDAQ",
            "Apple Inc.",
            InstrumentClass.EQUITY,
            CashCurrency.USD,
            "https://example.com/aapl.png",
            "Consumer electronics"
        );

        when(instrumentRepository.existsByTickerIgnoreCase("aapl")).thenReturn(false);
        when(instrumentRepository.save(any(Instrument.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Instrument created = instrumentService.createInstrument(request);

        verify(instrumentRepository, times(1)).save(any(Instrument.class));
        assertEquals("AAPL", created.getTicker());
        assertEquals("NASDAQ", created.getMarket());
    }

    @Test
    void createInstrument_duplicateTicker_throwsConflict() {
        CreateInstrumentRequest request = new CreateInstrumentRequest(
            "AAPL",
            "NASDAQ",
            "Apple Inc.",
            InstrumentClass.EQUITY,
            CashCurrency.USD,
            null,
            null
        );

        when(instrumentRepository.existsByTickerIgnoreCase("AAPL")).thenReturn(true);

        assertThrows(InstrumentConflictException.class, () -> instrumentService.createInstrument(request));

        verify(instrumentRepository, never()).save(any(Instrument.class));
    }

    @Test
    void updateInstrument_requiresAdminAndUpdatesAllowedFields() {
        UUID instrumentId = UUID.randomUUID();
        Instrument existing = new Instrument("AAPL", "NASDAQ", "Apple", InstrumentClass.EQUITY, CashCurrency.USD);

        UpdateInstrumentRequest request = new UpdateInstrumentRequest(
            "Apple Inc.",
            "https://example.com/new-aapl.png",
            "Updated description"
        );

        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(existing));
        when(instrumentRepository.save(existing)).thenReturn(existing);

        Instrument updated = instrumentService.updateInstrument(instrumentId, request);

        assertEquals("Apple Inc.", updated.getName());
        assertEquals("https://example.com/new-aapl.png", updated.getLogoUrl());
        assertEquals("Updated description", updated.getDescription());
    }

    @Test
    void updateInstrument_notFound_throwsNotFound() {
        UUID instrumentId = UUID.randomUUID();
        UpdateInstrumentRequest request = new UpdateInstrumentRequest("Name", null, null);

        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.empty());

        assertThrows(InstrumentNotFoundException.class, () -> instrumentService.updateInstrument(instrumentId, request));

        verify(instrumentRepository, never()).save(any(Instrument.class));
    }

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
