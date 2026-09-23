package com.example.backend.repository;

import com.example.backend.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

    List<Portfolio> findByProfileUserId(UUID userId);

    Optional<Portfolio> findByPortfolioIdAndProfileUserId(UUID portfolioId, UUID userId);
}
