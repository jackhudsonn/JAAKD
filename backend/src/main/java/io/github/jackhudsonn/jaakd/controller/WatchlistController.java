package io.github.jackhudsonn.jaakd.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.jackhudsonn.jaakd.dto.CreateWatchlistItemRequest;
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
    @ResponseStatus(HttpStatus.OK)
    public List<WatchlistItemResponse> getWatchlistItemsByPortfolio(@PathVariable UUID portfolioId) {
        List<WatchlistItem> items = watchlistItemService.getWatchlistItemsForPortfolio(portfolioId);
        List<WatchlistItemResponse> responses = new ArrayList<>();

        for (int i = 0; i < items.size(); i++) {
            responses.add(toResponse(items.get(i)));
        }

        return responses;
    }

    @GetMapping("/{listItemId}")
    @ResponseStatus(HttpStatus.OK)
    public WatchlistItemResponse getWatchlistItemById(@PathVariable UUID listItemId) {
        WatchlistItem item = watchlistItemService.getWatchlistItemById(listItemId);
        return toResponse(item);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistItemResponse createWatchlistItem(@Valid @RequestBody CreateWatchlistItemRequest request) {
        WatchlistItem created = watchlistItemService.createWatchlistItem(request);
        return toResponse(created);
    }


    @DeleteMapping("/{listItemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWatchlistItem(@PathVariable UUID listItemId) {
        watchlistItemService.deleteWatchlistItem(listItemId);
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
