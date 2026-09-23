package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistItemRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateWatchlistItemRequest;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.WatchlistItemRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class WatchlistItemService {

    private final WatchlistItemRepository watchlistItemRepository;
    private final PortfolioRepository portfolioRepository;
    private final InstrumentRepository instrumentRepository;
    private final CurrentUserService currentUserService;

    public WatchlistItemService(
            WatchlistItemRepository watchlistItemRepository,
            PortfolioRepository portfolioRepository,
            InstrumentRepository instrumentRepository,
            CurrentUserService currentUserService
    ) {
        this.watchlistItemRepository = watchlistItemRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.currentUserService = currentUserService;
    }

    public List<WatchlistItem> getWatchlistItemsForPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        return watchlistItemRepository.findByPortfolioPortfolioIdAndPortfolioProfileUserId(portfolioId, userId);
    }

    public WatchlistItem getWatchlistItemById(UUID listItemId) {
        UUID userId = currentUserService.getUserId();
        Optional<WatchlistItem> maybeItem = watchlistItemRepository.findByListItemIdAndPortfolioProfileUserId(listItemId, userId);

        if (maybeItem.isEmpty()) {
            throw new IllegalArgumentException("Watchlist item not found for id: " + listItemId);
        }

        return maybeItem.get();
    }

    @Transactional
    public WatchlistItem createWatchlistItem(CreateWatchlistItemRequest request) {
        // 1. Resolve current user
        UUID userId = currentUserService.getUserId();

        // 2. Ensure portfolio exists and belongs to user
        Optional<Portfolio> maybePortfolio = portfolioRepository.findByPortfolioIdAndProfileUserId(request.portfolioId(), userId);
        if (maybePortfolio.isEmpty()) {
            throw new IllegalArgumentException("Portfolio not found for id: " + request.portfolioId());
        }
        Portfolio portfolio = maybePortfolio.get();

        // 3. Ensure instrument exists
        Optional<Instrument> maybeInstrument = instrumentRepository.findById(request.instrumentId());
        if (maybeInstrument.isEmpty()) {
            throw new IllegalArgumentException("Instrument not found for id: " + request.instrumentId());
        }
        Instrument instrument = maybeInstrument.get();

        // 4. Prevent duplicate portfolio+instrument watchlist item
        Optional<WatchlistItem> maybeExisting = watchlistItemRepository
                .findByPortfolioPortfolioIdAndInstrumentInstrumentIdAndPortfolioProfileUserId(
                        request.portfolioId(),
                        request.instrumentId(),
                        userId
                );
        if (maybeExisting.isPresent()) {
            throw new IllegalArgumentException("Watchlist item already exists for this portfolio and instrument");
        }

        // 5. Build and persist
        WatchlistItem item = new WatchlistItem(portfolio, instrument);
        if (request.name() != null) {
            item.setWatchListName(request.name());
        }

        return watchlistItemRepository.save(item);
    }

    @Transactional
    public WatchlistItem updateWatchlistItem(UUID listItemId, UpdateWatchlistItemRequest request) {
        // 1. Load owned item
        UUID userId = currentUserService.getUserId();
        Optional<WatchlistItem> maybeItem = watchlistItemRepository.findByListItemIdAndPortfolioProfileUserId(listItemId, userId);

        if (maybeItem.isEmpty()) {
            throw new IllegalArgumentException("Watchlist item not found for id: " + listItemId);
        }

        WatchlistItem item = maybeItem.get();

        // 2. Apply updates
        if (request.name() != null) {
            item.setWatchListName(request.name());
        }

        // 3. Persist updates
        return watchlistItemRepository.save(item);
    }

    @Transactional
    public void deleteWatchlistItem(UUID listItemId) {
        // 1. Load owned item
        UUID userId = currentUserService.getUserId();
        Optional<WatchlistItem> maybeItem = watchlistItemRepository.findByListItemIdAndPortfolioProfileUserId(listItemId, userId);

        if (maybeItem.isEmpty()) {
            throw new IllegalArgumentException("Watchlist item not found for id: " + listItemId);
        }

        // 2. Delete
        watchlistItemRepository.delete(maybeItem.get());
    }
}
