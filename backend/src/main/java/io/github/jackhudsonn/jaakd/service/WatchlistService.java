package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistEntryRequest;
import io.github.jackhudsonn.jaakd.dto.CreateWatchlistRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateWatchlistRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.exception.WatchlistConflictException;
import io.github.jackhudsonn.jaakd.exception.WatchlistItemConflictException;
import io.github.jackhudsonn.jaakd.exception.WatchlistItemNotFoundException;
import io.github.jackhudsonn.jaakd.exception.WatchlistNotFoundException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.User;
import io.github.jackhudsonn.jaakd.model.Watchlist;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.UserRepository;
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
    private static final int MAX_WATCHLISTS_PER_USER = 15;
    private static final int MIN_WATCHLIST_NAME_LENGTH = 3;
    private static final int MAX_WATCHLIST_NAME_LENGTH = 20;
    private static final Pattern WATCHLIST_NAME_PATTERN = Pattern.compile("^[A-Za-z0-9' -]+$");

    private final WatchlistRepository watchlistRepository;
    private final WatchlistItemRepository watchlistItemRepository;
    private final InstrumentRepository instrumentRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;

    public WatchlistService(
        WatchlistRepository watchlistRepository,
        WatchlistItemRepository watchlistItemRepository,
        InstrumentRepository instrumentRepository,
        UserRepository userRepository,
        CurrentUserService currentUserService
    ) {
        this.watchlistRepository = watchlistRepository;
        this.watchlistItemRepository = watchlistItemRepository;
        this.instrumentRepository = instrumentRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public List<Watchlist> getCurrentUserWatchlists() {
        UUID userId = currentUserService.getUserId();
        ensureDefaultWatchlistForUser(userId);
        return watchlistRepository.findByUserUserIdOrderByWatchlistIdAsc(userId);
    }

    @Transactional
    public Watchlist createWatchlist(CreateWatchlistRequest request) {
        UUID userId = currentUserService.getUserId();
        String watchlistName = normalizeAndValidateName(request.watchlistName());

        if (watchlistRepository.countByUserUserId(userId) >= MAX_WATCHLISTS_PER_USER) {
            throw new WatchlistConflictException("You can create up to 15 watchlists.");
        }

        if (watchlistRepository.existsByUserUserIdAndWatchlistName(userId, watchlistName)) {
            throw new WatchlistConflictException("A watchlist with that name already exists.");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ValidationException("Unable to create watchlist for user."));

        return watchlistRepository.save(new Watchlist(user, watchlistName));
    }

    @Transactional
    public Watchlist updateWatchlist(UUID watchlistId, UpdateWatchlistRequest request) {
        UUID userId = currentUserService.getUserId();
        Watchlist watchlist = watchlistRepository.findByWatchlistIdAndUserUserId(watchlistId, userId)
            .orElseThrow(() -> new WatchlistNotFoundException(watchlistId));

        String watchlistName = normalizeAndValidateName(request.watchlistName());
        if (watchlistRepository.existsByUserUserIdAndWatchlistNameAndWatchlistIdNot(
            userId,
            watchlistName,
            watchlistId
        )) {
            throw new WatchlistConflictException("A watchlist with that name already exists.");
        }

        watchlist.setWatchlistName(watchlistName);
        return watchlistRepository.save(watchlist);
    }

    @Transactional
    public void deleteWatchlist(UUID watchlistId) {
        UUID userId = currentUserService.getUserId();
        Watchlist watchlist = watchlistRepository.findByWatchlistIdAndUserUserId(watchlistId, userId)
            .orElseThrow(() -> new WatchlistNotFoundException(watchlistId));
        watchlistRepository.delete(watchlist);
    }

    @Transactional
    public WatchlistItem createWatchlistItem(UUID watchlistId, CreateWatchlistEntryRequest request) {
        UUID userId = currentUserService.getUserId();
        Watchlist watchlist = watchlistRepository.findByWatchlistIdAndUserUserId(watchlistId, userId)
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
    public void deleteWatchlistItem(UUID watchlistId, UUID listItemId) {
        UUID userId = currentUserService.getUserId();
        WatchlistItem item = watchlistItemRepository
            .findByListItemIdAndWatchlistWatchlistIdAndWatchlistUserUserId(listItemId, watchlistId, userId)
            .orElseThrow(() -> new WatchlistItemNotFoundException(listItemId));

        watchlistItemRepository.delete(item);
    }

    @Transactional
    public void ensureDefaultWatchlistForUser(UUID userId) {
        if (watchlistRepository.countByUserUserId(userId) > 0) {
            return;
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ValidationException("Unable to create default watchlist for user."));

        watchlistRepository.save(new Watchlist(user, DEFAULT_WATCHLIST_NAME));
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
