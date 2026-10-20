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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/watchlists")
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
    public List<WatchlistResponse> getWatchlists() {
        // TODO: Add pagination for watchlists and watchlist items once very large user lists are expected.
        List<Watchlist> watchlists = watchlistService.getCurrentUserWatchlists();
        List<UUID> watchlistIds = watchlists.stream().map(Watchlist::getWatchlistId).toList();
        List<WatchlistItem> items = watchlistIds.isEmpty()
            ? List.of()
            : watchlistItemRepository.findByWatchlistWatchlistIdInOrderByListItemIdAsc(watchlistIds);

        Map<UUID, List<WatchlistItemResponse>> itemsByWatchlistId = new HashMap<>();
        for (WatchlistItem item : items) {
            UUID watchlistId = item.getWatchlist().getWatchlistId();
            List<WatchlistItemResponse> grouped = itemsByWatchlistId.get(watchlistId);
            if (grouped == null) {
                grouped = new ArrayList<>();
                itemsByWatchlistId.put(watchlistId, grouped);
            }
            grouped.add(toItemResponse(item));
        }

        List<WatchlistResponse> responses = new ArrayList<>();
        for (Watchlist watchlist : watchlists) {
            responses.add(new WatchlistResponse(
                watchlist.getWatchlistId(),
                watchlist.getWatchlistName(),
                itemsByWatchlistId.getOrDefault(watchlist.getWatchlistId(), List.of())
            ));
        }

        return responses;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistResponse createWatchlist(@Valid @RequestBody CreateWatchlistRequest request) {
        Watchlist created = watchlistService.createWatchlist(request);
        return new WatchlistResponse(created.getWatchlistId(), created.getWatchlistName(), List.of());
    }

    @PutMapping("/{watchlistId}")
    @ResponseStatus(HttpStatus.OK)
    public WatchlistResponse updateWatchlist(
        @PathVariable UUID watchlistId,
        @Valid @RequestBody UpdateWatchlistRequest request
    ) {
        Watchlist updated = watchlistService.updateWatchlist(watchlistId, request);
        List<WatchlistItem> items = watchlistItemRepository.findByWatchlistWatchlistIdInOrderByListItemIdAsc(
            List.of(updated.getWatchlistId())
        );
        List<WatchlistItemResponse> itemResponses = new ArrayList<>();
        for (WatchlistItem item : items) {
            itemResponses.add(toItemResponse(item));
        }

        return new WatchlistResponse(updated.getWatchlistId(), updated.getWatchlistName(), itemResponses);
    }

    @DeleteMapping("/{watchlistId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWatchlist(@PathVariable UUID watchlistId) {
        watchlistService.deleteWatchlist(watchlistId);
    }

    @PostMapping("/{watchlistId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistItemResponse createWatchlistItem(
        @PathVariable UUID watchlistId,
        @Valid @RequestBody CreateWatchlistEntryRequest request
    ) {
        WatchlistItem created = watchlistService.createWatchlistItem(watchlistId, request);
        return toItemResponse(created);
    }

    @DeleteMapping("/{watchlistId}/items/{listItemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWatchlistItem(
        @PathVariable UUID watchlistId,
        @PathVariable UUID listItemId
    ) {
        watchlistService.deleteWatchlistItem(watchlistId, listItemId);
    }

    private WatchlistItemResponse toItemResponse(WatchlistItem item) {
        return new WatchlistItemResponse(
            item.getListItemId(),
            item.getWatchlist().getWatchlistId(),
            item.getInstrument().getInstrumentId()
        );
    }
}
