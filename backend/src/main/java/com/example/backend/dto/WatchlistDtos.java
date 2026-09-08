package com.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

// All request/response DTOs for the watchlist feature, grouped in one file.
public final class WatchlistDtos {

    private WatchlistDtos() {
    }

    // Request body for POST /api/watchlists — new watchlist is appended to the bottom of the portfolio's priority order.
    public record CreateWatchlistRequest(
        @NotNull(message = "portfolioId is required") UUID portfolioId,
        @NotBlank(message = "name is required") String name) {
    }

    // Request body for POST /api/watchlists/{watchListId}/items
    public record AddWatchlistItemRequest(
        @NotNull(message = "instrumentId is required") UUID instrumentId) {
    }

    // Request body for PUT /api/watchlists/{watchListId}/priority — lower value sorts closer to the top.
    public record UpdateWatchlistPriorityRequest(
        @NotNull(message = "priority is required") Long priority) {
    }

    // Request body for PUT /api/watchlists/{watchListId}/name
    public record UpdateWatchlistNameRequest(
        @NotBlank(message = "name is required") String name) {
    }

    // Item + its denormalized instrument info, for display in a watchlist without extra client-side lookups.
    public record WatchlistItemResponse(
        UUID listItemId,
        UUID instrumentId,
        String ticker,
        String type,
        String market,
        Double price) {
    }

    // Summary of a watchlist, without its items — used for listing all watchlists in a portfolio.
    public record WatchlistResponse(
        UUID watchListId,
        UUID portfolioId,
        String name,
        Long priority) {
    }

    // Full watchlist detail — items are pre-sorted alphabetically by ticker.
    public record WatchlistDetailResponse(
        UUID watchListId,
        UUID portfolioId,
        String name,
        Long priority,
        List<WatchlistItemResponse> items) {
    }
}
