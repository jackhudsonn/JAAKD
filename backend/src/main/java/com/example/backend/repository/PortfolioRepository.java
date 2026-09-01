package com.example.backend.repository;

import com.example.backend.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

    List<Portfolio> findByUserId(UUID userId);
}
