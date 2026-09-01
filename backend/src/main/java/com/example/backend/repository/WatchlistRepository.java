package com.example.backend.repository;

import com.example.backend.model.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WatchlistRepository extends JpaRepository<Watchlist, UUID> {

    List<Watchlist> findByPortfolioId(UUID portfolioId);
}
