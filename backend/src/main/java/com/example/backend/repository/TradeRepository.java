package com.example.backend.repository;

import com.example.backend.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {

    List<Trade> findByHoldingId(UUID holdingId);

    Optional<Trade> findByOrderLogId(UUID orderLogId);
}
