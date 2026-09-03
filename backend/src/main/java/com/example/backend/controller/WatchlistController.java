package com.example.backend.controller;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.dto.WatchlistDtos.AddWatchlistItemRequest;
import com.example.backend.dto.WatchlistDtos.CreateWatchlistRequest;
import com.example.backend.dto.WatchlistDtos.UpdateWatchlistNameRequest;
import com.example.backend.dto.WatchlistDtos.UpdateWatchlistPriorityRequest;
import com.example.backend.dto.WatchlistDtos.WatchlistDetailResponse;
import com.example.backend.dto.WatchlistDtos.WatchlistItemResponse;
import com.example.backend.dto.WatchlistDtos.WatchlistResponse;
import com.example.backend.service.WatchlistService;

import java.util.List;
import java.util.UUID;

@RestController
public class WatchlistController {

    private final WatchlistService watchlistService;

    public WatchlistController(WatchlistService watchlistService) {
        this.watchlistService = watchlistService;
    }

    @GetMapping("/api/watchlists")
    public List<WatchlistResponse> listWatchlists(@RequestParam UUID portfolioId) {
        return watchlistService.listWatchlists(portfolioId);
    }

    @PostMapping("/api/watchlists")
    public WatchlistResponse createWatchlist(@Valid @RequestBody CreateWatchlistRequest request) {
        return watchlistService.createWatchlist(request);
    }

    @GetMapping("/api/watchlists/{watchListId}")
    public WatchlistDetailResponse getWatchlist(@PathVariable UUID watchListId) {
        return watchlistService.getWatchlist(watchListId);
    }

    @PutMapping("/api/watchlists/{watchListId}/name")
    public WatchlistResponse renameWatchlist(@PathVariable UUID watchListId, @Valid @RequestBody UpdateWatchlistNameRequest request) {
        return watchlistService.renameWatchlist(watchListId, request.name());
    }

    @PutMapping("/api/watchlists/{watchListId}/priority")
    public WatchlistResponse updatePriority(@PathVariable UUID watchListId, @Valid @RequestBody UpdateWatchlistPriorityRequest request) {
        return watchlistService.updatePriority(watchListId, request.priority());
    }

    @DeleteMapping("/api/watchlists/{watchListId}")
    public String deleteWatchlist(@PathVariable UUID watchListId) {
        return watchlistService.deleteWatchlist(watchListId);
    }

    @PostMapping("/api/watchlists/{watchListId}/items")
    public WatchlistItemResponse addItem(@PathVariable UUID watchListId, @Valid @RequestBody AddWatchlistItemRequest request) {
        return watchlistService.addItem(watchListId, request);
    }

    @DeleteMapping("/api/watchlists/items/{listItemId}")
    public String removeItem(@PathVariable UUID listItemId) {
        return watchlistService.removeItem(listItemId);
    }
}
