package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistEntryRequest;
import io.github.jackhudsonn.jaakd.dto.CreateWatchlistRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateWatchlistRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.exception.WatchlistConflictException;
import io.github.jackhudsonn.jaakd.exception.WatchlistItemConflictException;
import io.github.jackhudsonn.jaakd.exception.WatchlistItemNotFoundException;
import io.github.jackhudsonn.jaakd.exception.WatchlistNotFoundException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.model.Watchlist;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.WatchlistItemRepository;
import io.github.jackhudsonn.jaakd.repository.WatchlistRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class WatchlistService {

    private static final String DEFAULT_WATCHLIST_NAME = "My Watchlist";
    private static final int MAX_WATCHLISTS_PER_PORTFOLIO = 15;
    private static final int MIN_WATCHLIST_NAME_LENGTH = 3;
    private static final int MAX_WATCHLIST_NAME_LENGTH = 20;
    private static final Pattern WATCHLIST_NAME_PATTERN = Pattern.compile("^[A-Za-z0-9' -]+$");

    private final WatchlistRepository watchlistRepository;
    private final WatchlistItemRepository watchlistItemRepository;
    private final InstrumentRepository instrumentRepository;
    private final PortfolioRepository portfolioRepository;
    private final CurrentUserService currentUserService;

    public WatchlistService(
        WatchlistRepository watchlistRepository,
        WatchlistItemRepository watchlistItemRepository,
        InstrumentRepository instrumentRepository,
        PortfolioRepository portfolioRepository,
        CurrentUserService currentUserService
    ) {
        this.watchlistRepository = watchlistRepository;
        this.watchlistItemRepository = watchlistItemRepository;
        this.instrumentRepository = instrumentRepository;
        this.portfolioRepository = portfolioRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public List<Watchlist> getCurrentUserWatchlists(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        Portfolio portfolio = getOwnedPortfolio(portfolioId, userId);
        ensureDefaultWatchlistForPortfolio(portfolio);
        return watchlistRepository.findByPortfolioPortfolioIdOrderByWatchlistIdAsc(portfolioId);
    }

    @Transactional
    public Watchlist createWatchlist(UUID portfolioId, CreateWatchlistRequest request) {
        UUID userId = currentUserService.getUserId();
        Portfolio portfolio = getOwnedPortfolio(portfolioId, userId);
        String watchlistName = normalizeAndValidateName(request.watchlistName());

        if (watchlistRepository.countByPortfolioPortfolioId(portfolioId) >= MAX_WATCHLISTS_PER_PORTFOLIO) {
            throw new WatchlistConflictException("You can create up to 15 watchlists.");
        }

        if (watchlistRepository.existsByPortfolioPortfolioIdAndWatchlistName(portfolioId, watchlistName)) {
            throw new WatchlistConflictException("A watchlist with that name already exists.");
        }

        return watchlistRepository.save(new Watchlist(portfolio, watchlistName));
    }

    @Transactional
    public Watchlist updateWatchlist(UUID portfolioId, UUID watchlistId, UpdateWatchlistRequest request) {
        UUID userId = currentUserService.getUserId();
        Watchlist watchlist = watchlistRepository
            .findByWatchlistIdAndPortfolioPortfolioIdAndPortfolioProfileUserId(watchlistId, portfolioId, userId)
            .orElseThrow(() -> new WatchlistNotFoundException(watchlistId));

        String watchlistName = normalizeAndValidateName(request.watchlistName());
        if (watchlistRepository.existsByPortfolioPortfolioIdAndWatchlistNameAndWatchlistIdNot(
            portfolioId,
            watchlistName,
            watchlistId
        )) {
            throw new WatchlistConflictException("A watchlist with that name already exists.");
        }

        watchlist.setWatchlistName(watchlistName);
        return watchlistRepository.save(watchlist);
    }

    @Transactional
    public void deleteWatchlist(UUID portfolioId, UUID watchlistId) {
        UUID userId = currentUserService.getUserId();
        Watchlist watchlist = watchlistRepository
            .findByWatchlistIdAndPortfolioPortfolioIdAndPortfolioProfileUserId(watchlistId, portfolioId, userId)
            .orElseThrow(() -> new WatchlistNotFoundException(watchlistId));
        watchlistRepository.delete(watchlist);
    }

    @Transactional
    public WatchlistItem createWatchlistItem(UUID portfolioId, UUID watchlistId, CreateWatchlistEntryRequest request) {
        UUID userId = currentUserService.getUserId();
        Watchlist watchlist = watchlistRepository
            .findByWatchlistIdAndPortfolioPortfolioIdAndPortfolioProfileUserId(watchlistId, portfolioId, userId)
            .orElseThrow(() -> new WatchlistNotFoundException(watchlistId));
        Instrument instrument = instrumentRepository.findById(request.instrumentId())
            .orElseThrow(() -> new InstrumentNotFoundException(request.instrumentId()));

        if (watchlistItemRepository.findByWatchlistWatchlistIdAndInstrumentInstrumentId(
            watchlistId,
            request.instrumentId()
        ).isPresent()) {
            throw new WatchlistItemConflictException();
        }

        return watchlistItemRepository.save(new WatchlistItem(watchlist, instrument));
    }

    @Transactional
    public void deleteWatchlistItem(UUID portfolioId, UUID watchlistId, UUID listItemId) {
        UUID userId = currentUserService.getUserId();
        WatchlistItem item = watchlistItemRepository
            .findByListItemIdAndWatchlistWatchlistIdAndWatchlistPortfolioPortfolioIdAndWatchlistPortfolioProfileUserId(
                listItemId,
                watchlistId,
                portfolioId,
                userId
            )
            .orElseThrow(() -> new WatchlistItemNotFoundException(listItemId));

        watchlistItemRepository.delete(item);
    }

    @Transactional
    public void ensureDefaultWatchlistForPortfolio(Portfolio portfolio) {
        UUID portfolioId = portfolio.getPortfolioId();
        if (watchlistRepository.countByPortfolioPortfolioId(portfolioId) > 0) {
            return;
        }
        watchlistRepository.save(new Watchlist(portfolio, DEFAULT_WATCHLIST_NAME));
    }

    private Portfolio getOwnedPortfolio(UUID portfolioId, UUID userId) {
        return portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)
            .orElseThrow(() -> new PortfolioNotFoundException(portfolioId));
    }

    private String normalizeAndValidateName(String rawName) {
        String normalized = rawName == null ? "" : rawName.trim();

        if (normalized.length() < MIN_WATCHLIST_NAME_LENGTH || normalized.length() > MAX_WATCHLIST_NAME_LENGTH) {
            throw new ValidationException("Watchlist name must be between 3 and 20 characters.");
        }

        if (!WATCHLIST_NAME_PATTERN.matcher(normalized).matches()) {
            throw new ValidationException("Watchlist name can contain letters, numbers, spaces, apostrophes, and hyphens.");
        }

        return normalized;
    }
}
