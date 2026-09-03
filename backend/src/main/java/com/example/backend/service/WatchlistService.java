package com.example.backend.service;

import org.springframework.stereotype.Service;

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

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final WatchlistItemRepository watchlistItemRepository;
    private final PortfolioRepository portfolioRepository;
    private final InstrumentRepository instrumentRepository;
    private final CurrentUserService currentUserService;

    public WatchlistService(
            WatchlistRepository watchlistRepository,
            WatchlistItemRepository watchlistItemRepository,
            PortfolioRepository portfolioRepository,
            InstrumentRepository instrumentRepository,
            CurrentUserService currentUserService) {
        this.watchlistRepository = watchlistRepository;
        this.watchlistItemRepository = watchlistItemRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.currentUserService = currentUserService;
    }

    // ==================== CREATE ====================
    public WatchlistResponse createWatchlist(CreateWatchlistRequest request) {
        // 1. Validate portfolio ownership
        Portfolio portfolio = requireOwnedPortfolio(request.portfolioId());

        // 2. Append new watchlist to the bottom of this portfolio's priority order
        List<Watchlist> existing = watchlistRepository.findByPortfolioIdOrderByPriorityAsc(request.portfolioId());
        long nextPriority = existing.isEmpty() ? 0L : existing.get(existing.size() - 1).getPriority() + 1;

        Watchlist watchlist = new Watchlist(request.portfolioId());
        watchlist.setName(request.name());
        watchlist.setPriority(nextPriority);
        Watchlist saved = watchlistRepository.save(watchlist);

        return toWatchlistResponse(saved);
    }

    // ==================== LIST (per portfolio, ordered by priority) ====================
    public List<WatchlistResponse> listWatchlists(UUID portfolioId) {
        requireOwnedPortfolio(portfolioId);

        return watchlistRepository.findByPortfolioIdOrderByPriorityAsc(portfolioId)
                .stream()
                .map(this::toWatchlistResponse)
                .toList();
    }

    // ==================== DETAIL (items sorted alphabetically by ticker) ====================
    public WatchlistDetailResponse getWatchlist(UUID watchListId) {
        Watchlist watchlist = requireOwnedWatchlist(watchListId);

        List<WatchlistItemResponse> items = watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId)
                .stream()
                .map(this::toItemResponse)
                .sorted(Comparator.comparing(WatchlistItemResponse::ticker, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();

        return new WatchlistDetailResponse(
                watchlist.getWatchListId(),
                watchlist.getPortfolioId(),
                watchlist.getName(),
                watchlist.getPriority(),
                items);
    }

    // ==================== RENAME ====================
    public WatchlistResponse renameWatchlist(UUID watchListId, String name) {
        Watchlist watchlist = requireOwnedWatchlist(watchListId);
        watchlist.setName(name);
        return toWatchlistResponse(watchlistRepository.save(watchlist));
    }

    // ==================== REORDER (change priority among the portfolio's watchlists) ====================
    public WatchlistResponse updatePriority(UUID watchListId, Long priority) {
        Watchlist watchlist = requireOwnedWatchlist(watchListId);
        watchlist.setPriority(priority);
        return toWatchlistResponse(watchlistRepository.save(watchlist));
    }

    // ==================== DELETE ====================
    public String deleteWatchlist(UUID watchListId) {
        Watchlist watchlist = requireOwnedWatchlist(watchListId);

        List<WatchlistItem> items = watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId);
        watchlistItemRepository.deleteAll(items);
        watchlistRepository.delete(watchlist);

        return "Watchlist deleted: " + watchListId;
    }

    // ==================== ADD ITEM ====================
    public WatchlistItemResponse addItem(UUID watchListId, AddWatchlistItemRequest request) {
        // 1. Validate watchlist ownership
        Watchlist watchlist = requireOwnedWatchlist(watchListId);

        // 2. Validate instrument exists
        Instrument instrument = instrumentRepository.findById(request.instrumentId())
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found"));

        // 3. Prevent duplicate instrument in the same watchlist
        List<WatchlistItem> existingItems = watchlistItemRepository.findByWatchListIdOrderByPriorityAsc(watchListId);
        boolean alreadyAdded = existingItems.stream()
                .anyMatch(item -> item.getInstrumentId().equals(request.instrumentId()));
        if (alreadyAdded) {
            throw new IllegalArgumentException("Instrument already in this watchlist");
        }

        // 4. Append item (priority here just tracks insertion order; display order is alphabetical)
        long nextPriority = existingItems.isEmpty() ? 0L : existingItems.get(existingItems.size() - 1).getPriority() + 1;
        WatchlistItem item = new WatchlistItem(watchListId, request.instrumentId(), nextPriority);
        WatchlistItem saved = watchlistItemRepository.save(item);

        return toItemResponse(saved, instrument);
    }

    // ==================== REMOVE ITEM ====================
    public String removeItem(UUID listItemId) {
        WatchlistItem item = watchlistItemRepository.findById(listItemId)
                .orElseThrow(() -> new IllegalArgumentException("Watchlist item not found"));

        // Validate ownership via the parent watchlist's portfolio
        requireOwnedWatchlist(item.getWatchListId());

        watchlistItemRepository.delete(item);
        return "Watchlist item removed: " + listItemId;
    }

    // ==================== HELPER METHODS ====================
    private Portfolio requireOwnedPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        if (!portfolio.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Portfolio does not belong to current user");
        }
        return portfolio;
    }

    private Watchlist requireOwnedWatchlist(UUID watchListId) {
        Watchlist watchlist = watchlistRepository.findById(watchListId)
                .orElseThrow(() -> new IllegalArgumentException("Watchlist not found"));
        requireOwnedPortfolio(watchlist.getPortfolioId());
        return watchlist;
    }

    private WatchlistResponse toWatchlistResponse(Watchlist watchlist) {
        return new WatchlistResponse(
                watchlist.getWatchListId(),
                watchlist.getPortfolioId(),
                watchlist.getName(),
                watchlist.getPriority());
    }

    private WatchlistItemResponse toItemResponse(WatchlistItem item) {
        Instrument instrument = instrumentRepository.findById(item.getInstrumentId())
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found"));
        return toItemResponse(item, instrument);
    }

    private WatchlistItemResponse toItemResponse(WatchlistItem item, Instrument instrument) {
        return new WatchlistItemResponse(
                item.getListItemId(),
                item.getInstrumentId(),
                instrument.getTicker(),
                instrument.getType(),
                instrument.getMarket(),
                instrument.getPrice());
    }
}
