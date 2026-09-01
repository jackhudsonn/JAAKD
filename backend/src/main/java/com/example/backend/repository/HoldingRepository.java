package com.example.backend.repository;

import com.example.backend.model.Holding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {

    List<Holding> findByPortfolioId(UUID portfolioId);

    Optional<Holding> findByPortfolioIdAndInstrumentId(UUID portfolioId, UUID instrumentId);
}
