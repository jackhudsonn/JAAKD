package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistItemRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateWatchlistItemRequest;
import io.github.jackhudsonn.jaakd.dto.WatchlistItemResponse;
import io.github.jackhudsonn.jaakd.model.WatchlistItem;
import io.github.jackhudsonn.jaakd.service.WatchlistItemService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/watchlists")
public class WatchlistController {

    private final WatchlistItemService watchlistItemService;

    public WatchlistController(WatchlistItemService watchlistItemService) {
        this.watchlistItemService = watchlistItemService;
    }

    @GetMapping("/portfolio/{portfolioId}")
    public ResponseEntity<List<WatchlistItemResponse>> getWatchlistItemsByPortfolio(@PathVariable UUID portfolioId) {
        List<WatchlistItem> items = watchlistItemService.getWatchlistItemsForPortfolio(portfolioId);
        List<WatchlistItemResponse> responses = new ArrayList<>();

        for (int i = 0; i < items.size(); i++) {
            responses.add(toResponse(items.get(i)));
        }

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{listItemId}")
    public ResponseEntity<WatchlistItemResponse> getWatchlistItemById(@PathVariable UUID listItemId) {
        WatchlistItem item = watchlistItemService.getWatchlistItemById(listItemId);
        return ResponseEntity.ok(toResponse(item));
    }

    @PostMapping
    public ResponseEntity<WatchlistItemResponse> createWatchlistItem(@Valid @RequestBody CreateWatchlistItemRequest request) {
        WatchlistItem created = watchlistItemService.createWatchlistItem(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
    }

    @PutMapping("/{listItemId}")
    public ResponseEntity<WatchlistItemResponse> updateWatchlistItem(
            @PathVariable UUID listItemId,
            @Valid @RequestBody UpdateWatchlistItemRequest request
    ) {
        WatchlistItem updated = watchlistItemService.updateWatchlistItem(listItemId, request);
        return ResponseEntity.ok(toResponse(updated));
    }

    @DeleteMapping("/{listItemId}")
    public ResponseEntity<Void> deleteWatchlistItem(@PathVariable UUID listItemId) {
        watchlistItemService.deleteWatchlistItem(listItemId);
        return ResponseEntity.noContent().build();
    }

    private WatchlistItemResponse toResponse(WatchlistItem item) {
        return new WatchlistItemResponse(
                item.getListItemId(),
                item.getPortfolio().getPortfolioId(),
                item.getInstrument().getInstrumentId(),
                item.getWatchListName()
        );
    }
}
