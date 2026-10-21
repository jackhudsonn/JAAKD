package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistEntryRequest;
import io.github.jackhudsonn.jaakd.dto.CreateWatchlistRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateWatchlistRequest;
import io.github.jackhudsonn.jaakd.dto.WatchlistResponse;
import io.github.jackhudsonn.jaakd.dto.WatchlistItemResponse;
import io.github.jackhudsonn.jaakd.model.Watchlist;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;
import io.github.jackhudsonn.jaakd.repository.WatchlistItemRepository;
import io.github.jackhudsonn.jaakd.service.WatchlistService;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/watchlists")
public class WatchlistController {

    private final WatchlistService watchlistService;
    private final WatchlistItemRepository watchlistItemRepository;

    public WatchlistController(
        WatchlistService watchlistService,
        WatchlistItemRepository watchlistItemRepository
    ) {
        this.watchlistService = watchlistService;
        this.watchlistItemRepository = watchlistItemRepository;
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<WatchlistResponse> getWatchlists(@PathVariable UUID portfolioId) {
        // TODO: Add pagination for watchlists and watchlist items once very large user lists are expected.
        List<Watchlist> watchlists = watchlistService.getCurrentUserWatchlists(portfolioId);
        List<UUID> watchlistIds = watchlists.stream().map(Watchlist::getWatchlistId).toList();
        List<WatchlistItem> items = watchlistIds.isEmpty()
            ? List.of()
            : watchlistItemRepository.findByWatchlistWatchlistIdInOrderByListItemIdAsc(watchlistIds);

        Map<UUID, List<WatchlistItemResponse>> itemsByWatchlistId = items.stream()
            .collect(Collectors.groupingBy(
                item -> item.getWatchlist().getWatchlistId(),
                Collectors.mapping(this::toItemResponse, Collectors.toList())
            ));

        return watchlists.stream()
            .map(watchlist -> new WatchlistResponse(
                watchlist.getWatchlistId(),
                watchlist.getWatchlistName(),
                itemsByWatchlistId.getOrDefault(watchlist.getWatchlistId(), List.of())
            ))
            .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistResponse createWatchlist(
        @PathVariable UUID portfolioId,
        @Valid @RequestBody CreateWatchlistRequest request
    ) {
        Watchlist created = watchlistService.createWatchlist(portfolioId, request);
        return new WatchlistResponse(created.getWatchlistId(), created.getWatchlistName(), List.of());
    }

    @PutMapping("/{watchlistId}")
    @ResponseStatus(HttpStatus.OK)
    public WatchlistResponse updateWatchlist(
        @PathVariable UUID portfolioId,
        @PathVariable UUID watchlistId,
        @Valid @RequestBody UpdateWatchlistRequest request
    ) {
        Watchlist updated = watchlistService.updateWatchlist(portfolioId, watchlistId, request);
        List<WatchlistItem> items = watchlistItemRepository.findByWatchlistWatchlistIdInOrderByListItemIdAsc(
            List.of(updated.getWatchlistId())
        );
        List<WatchlistItemResponse> itemResponses = items.stream().map(this::toItemResponse).toList();

        return new WatchlistResponse(updated.getWatchlistId(), updated.getWatchlistName(), itemResponses);
    }

    @DeleteMapping("/{watchlistId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWatchlist(
        @PathVariable UUID portfolioId,
        @PathVariable UUID watchlistId
    ) {
        watchlistService.deleteWatchlist(portfolioId, watchlistId);
    }

    @PostMapping("/{watchlistId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistItemResponse createWatchlistItem(
        @PathVariable UUID portfolioId,
        @PathVariable UUID watchlistId,
        @Valid @RequestBody CreateWatchlistEntryRequest request
    ) {
        WatchlistItem created = watchlistService.createWatchlistItem(portfolioId, watchlistId, request);
        return toItemResponse(created);
    }

    @DeleteMapping("/{watchlistId}/items/{listItemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWatchlistItem(
        @PathVariable UUID portfolioId,
        @PathVariable UUID watchlistId,
        @PathVariable UUID listItemId
    ) {
        watchlistService.deleteWatchlistItem(portfolioId, watchlistId, listItemId);
    }

    private WatchlistItemResponse toItemResponse(WatchlistItem item) {
        return new WatchlistItemResponse(
            item.getListItemId(),
            item.getWatchlist().getWatchlistId(),
            item.getInstrument().getInstrumentId()
        );
    }
}
