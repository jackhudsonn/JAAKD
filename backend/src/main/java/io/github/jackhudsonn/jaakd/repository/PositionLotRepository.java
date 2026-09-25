package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.PositionLot;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
        SELECT pl
        FROM PositionLot pl
        WHERE pl.holdingID = :holdingId
          AND EXISTS (
              SELECT 1
              FROM Holding h
              WHERE h.holdingID = pl.holdingID
                AND EXISTS (
                    SELECT 1
                    FROM Portfolio p
                    WHERE p.portfolioId = h.portfolioID
                      AND p.profile.userId = :userId
                )
          )
        ORDER BY pl.openedAt ASC, pl.positionLotID ASC
        """)
    List<PositionLot> findOwnedByHoldingIdOldestFirst(
        @Param("holdingId") UUID holdingId,
        @Param("userId") UUID userId
    );
}