package com.example.backend.service;

import com.example.backend.dto.WatchlistDtos.AddWatchlistItemRequest;
import com.example.backend.dto.WatchlistDtos.CreateWatchlistRequest;
import com.example.backend.dto.WatchlistDtos.WatchlistDetailResponse;
import com.example.backend.dto.WatchlistDtos.WatchlistItemResponse;
import com.example.backend.dto.WatchlistDtos.WatchlistResponse;
import com.example.backend.model.Instrument;
import com.example.backend.model.Portfolio;
import com.example.backend.model.Watchlist;
import com.example.backend.model.WatchlistItem;
import com.example.backend.repository.InstrumentRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.repository.WatchlistItemRepository;
import com.example.backend.repository.WatchlistRepository;
import com.example.backend.security.CurrentUserService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// See src/test/java/com/example/backend/service/README.md for how to run these tests.
@ExtendWith(MockitoExtension.class)
class WatchlistServiceTest {

    @Mock
    private WatchlistRepository watchlistRepository;
    @Mock
    private WatchlistItemRepository watchlistItemRepository;
    @Mock
    private PortfolioRepository portfolioRepository;
    @Mock
    private InstrumentRepository instrumentRepository;
    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private WatchlistService watchlistService;

    private UUID userId;
    private UUID portfolioId;
    private UUID watchListId;
    private UUID instrumentId;
    private UUID listItemId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        portfolioId = UUID.randomUUID();
        watchListId = UUID.randomUUID();
        instrumentId = UUID.randomUUID();
        listItemId = UUID.randomUUID();
    }

    private Instrument buildInstrument(String ticker) {
        Instrument instrument = new Instrument("stock");
        instrument.setTicker(ticker);
        return instrument;
    }

    // ==================== createWatchlist ====================

    @Test
    void createWatchlist_firstForPortfolio_getsPriorityZero() {
        Portfolio portfolio = new Portfolio(userId);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistRepository.findByPortfolioIdOrderByPriorityAsc(portfolioId)).thenReturn(List.of());
        when(watchlistRepository.save(any(Watchlist.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WatchlistResponse result = watchlistService.createWatchlist(new CreateWatchlistRequest(portfolioId, "Tech"));

        assertThat(result.name()).isEqualTo("Tech");
        assertThat(result.priority()).isEqualTo(0L);
    }

    @Test
    void createWatchlist_appendsAfterExistingWatchlists() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist existing = new Watchlist(portfolioId);
        existing.setPriority(3L);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistRepository.findByPortfolioIdOrderByPriorityAsc(portfolioId)).thenReturn(List.of(existing));
        when(watchlistRepository.save(any(Watchlist.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WatchlistResponse result = watchlistService.createWatchlist(new CreateWatchlistRequest(portfolioId, "Crypto"));

        assertThat(result.priority()).isEqualTo(4L);
    }

    @Test
    void createWatchlist_portfolioBelongsToDifferentUser_throws() {
        Portfolio portfolio = new Portfolio(UUID.randomUUID());

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        assertThatThrownBy(() -> watchlistService.createWatchlist(new CreateWatchlistRequest(portfolioId, "Tech")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong");
    }

    // ==================== listWatchlists ====================

    @Test
    void listWatchlists_returnsOrderedByPriority() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist healthcare = new Watchlist(portfolioId);
        healthcare.setName("Healthcare");
        healthcare.setPriority(0L);
        Watchlist banks = new Watchlist(portfolioId);
        banks.setName("Banks");
        banks.setPriority(1L);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistRepository.findByPortfolioIdOrderByPriorityAsc(portfolioId)).thenReturn(List.of(healthcare, banks));

        List<WatchlistResponse> result = watchlistService.listWatchlists(portfolioId);

        assertThat(result).extracting(WatchlistResponse::name).containsExactly("Healthcare", "Banks");
    }

    // ==================== getWatchlist ====================

    @Test
    void getWatchlist_sortsItemsAlphabeticallyByTicker() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        watchlist.setName("Tech");

        UUID msftId = UUID.randomUUID();
        UUID aaplId = UUID.randomUUID();
        WatchlistItem msftItem = new WatchlistItem(watchListId, msftId, 0L);
        WatchlistItem aaplItem = new WatchlistItem(watchListId, aaplId, 1L);

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId))
                .thenReturn(List.of(msftItem, aaplItem));
        when(instrumentRepository.findById(msftId)).thenReturn(Optional.of(buildInstrument("MSFT")));
        when(instrumentRepository.findById(aaplId)).thenReturn(Optional.of(buildInstrument("AAPL")));

        WatchlistDetailResponse result = watchlistService.getWatchlist(watchListId);

        assertThat(result.items()).extracting(WatchlistItemResponse::ticker).containsExactly("AAPL", "MSFT");
    }

    @Test
    void getWatchlist_notFound_throws() {
        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> watchlistService.getWatchlist(watchListId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Watchlist not found");
    }

    // ==================== renameWatchlist / updatePriority ====================

    @Test
    void renameWatchlist_updatesName() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        watchlist.setName("Old Name");

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistRepository.save(any(Watchlist.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WatchlistResponse result = watchlistService.renameWatchlist(watchListId, "New Name");

        assertThat(result.name()).isEqualTo("New Name");
    }

    @Test
    void updatePriority_updatesPriority() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        watchlist.setPriority(5L);

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistRepository.save(any(Watchlist.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WatchlistResponse result = watchlistService.updatePriority(watchListId, 0L);

        assertThat(result.priority()).isEqualTo(0L);
    }

    // ==================== deleteWatchlist ====================

    @Test
    void deleteWatchlist_removesItemsAndWatchlist() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        WatchlistItem item = new WatchlistItem(watchListId, instrumentId, 0L);

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId)).thenReturn(List.of(item));

        String result = watchlistService.deleteWatchlist(watchListId);

        assertThat(result).isEqualTo("Watchlist deleted: " + watchListId);
        verify(watchlistItemRepository).deleteAll(List.of(item));
        verify(watchlistRepository).delete(watchlist);
    }

    // ==================== addItem ====================

    @Test
    void addItem_newInstrument_savesWithNextPriority() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        Instrument instrument = buildInstrument("AAPL");
        WatchlistItem existingItem = new WatchlistItem(watchListId, UUID.randomUUID(), 0L);

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));
        when(watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId)).thenReturn(List.of(existingItem));
        when(watchlistItemRepository.save(any(WatchlistItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WatchlistItemResponse result = watchlistService.addItem(watchListId, new AddWatchlistItemRequest(instrumentId));

        assertThat(result.ticker()).isEqualTo("AAPL");
    }

    @Test
    void addItem_duplicateInstrument_throws() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        Instrument instrument = buildInstrument("AAPL");
        WatchlistItem existingItem = new WatchlistItem(watchListId, instrumentId, 0L);

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.of(instrument));
        when(watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId)).thenReturn(List.of(existingItem));

        assertThatThrownBy(() -> watchlistService.addItem(watchListId, new AddWatchlistItemRequest(instrumentId)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already in this watchlist");
    }

    @Test
    void addItem_instrumentNotFound_throws() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);

        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(instrumentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> watchlistService.addItem(watchListId, new AddWatchlistItemRequest(instrumentId)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Instrument not found");
    }

    // ==================== removeItem ====================

    @Test
    void removeItem_deletesItem() {
        Portfolio portfolio = new Portfolio(userId);
        Watchlist watchlist = new Watchlist(portfolioId);
        WatchlistItem item = new WatchlistItem(watchListId, instrumentId, 0L);

        when(watchlistItemRepository.findById(listItemId)).thenReturn(Optional.of(item));
        when(watchlistRepository.findById(watchListId)).thenReturn(Optional.of(watchlist));
        when(currentUserService.getUserId()).thenReturn(userId);
        when(portfolioRepository.findById(portfolioId)).thenReturn(Optional.of(portfolio));

        String result = watchlistService.removeItem(listItemId);

        assertThat(result).isEqualTo("Watchlist item removed: " + listItemId);
        verify(watchlistItemRepository).delete(item);
    }

    @Test
    void removeItem_notFound_throws() {
        when(watchlistItemRepository.findById(listItemId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> watchlistService.removeItem(listItemId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Watchlist item not found");
    }
}
