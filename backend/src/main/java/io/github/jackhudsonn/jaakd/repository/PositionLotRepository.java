package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.PositionLot;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface PositionLotRepository extends JpaRepository<PositionLot, UUID> {

    boolean existsBySourceBuyLogOrderID(UUID sourceBuyLogOrderID);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<PositionLot> findByHoldingIDAndRemainingQuantityGreaterThanOrderByOpenedAtAscPositionLotIDAsc(
        UUID holdingID,
        BigDecimal remainingQuantity
    );
}