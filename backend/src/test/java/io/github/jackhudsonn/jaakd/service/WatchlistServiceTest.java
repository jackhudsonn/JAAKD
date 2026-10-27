package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistEntryRequest;
import io.github.jackhudsonn.jaakd.exception.InvalidInstrumentException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Watchlist;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.WatchlistItemRepository;
import io.github.jackhudsonn.jaakd.repository.WatchlistRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WatchlistServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PORTFOLIO_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID WATCHLIST_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID INSTRUMENT_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final String INVALID_INSTRUMENT_MESSAGE =
        "Only equities, ETFs, and crypto instruments can be added to a watchlist.";

    @Mock
    private WatchlistRepository watchlistRepository;

    @Mock
    private WatchlistItemRepository watchlistItemRepository;

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private WatchlistService watchlistService;

    @ParameterizedTest
    @EnumSource(value = InstrumentClass.class, names = {"CASH", "FX"})
    void createWatchlistItem_rejectsNonTradableInstrumentClasses(InstrumentClass instrumentClass) {
        stubWatchlistAndInstrument(instrumentClass);

        InvalidInstrumentException error = assertThrows(
            InvalidInstrumentException.class,
            () -> watchlistService.createWatchlistItem(
                PORTFOLIO_ID,
                WATCHLIST_ID,
                new CreateWatchlistEntryRequest(INSTRUMENT_ID)
            )
        );

        assertEquals(INVALID_INSTRUMENT_MESSAGE, error.getMessage());
        verify(watchlistItemRepository, never()).save(any(WatchlistItem.class));
    }

    @ParameterizedTest
    @EnumSource(value = InstrumentClass.class, names = {"EQUITY", "ETF", "CRYPTO"})
    void createWatchlistItem_acceptsTradableInstrumentClasses(InstrumentClass instrumentClass) {
        stubWatchlistAndInstrument(instrumentClass);
        when(watchlistItemRepository.save(any(WatchlistItem.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        watchlistService.createWatchlistItem(
            PORTFOLIO_ID,
            WATCHLIST_ID,
            new CreateWatchlistEntryRequest(INSTRUMENT_ID)
        );

        verify(watchlistItemRepository).save(any(WatchlistItem.class));
    }

    private void stubWatchlistAndInstrument(InstrumentClass instrumentClass) {
        when(currentUserService.getUserId()).thenReturn(USER_ID);
        when(watchlistRepository.findByWatchlistIdAndPortfolioPortfolioIdAndPortfolioProfileUserId(
            WATCHLIST_ID,
            PORTFOLIO_ID,
            USER_ID
        )).thenReturn(Optional.of(new Watchlist(new Portfolio(null), "My Watchlist")));
        when(instrumentRepository.findById(INSTRUMENT_ID)).thenReturn(
            Optional.of(new Instrument("TEST", "TEST", "Test instrument", instrumentClass, CashCurrency.USD))
        );
    }
}
