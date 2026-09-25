package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.Holding;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {

  List<Holding> findByPortfolioID(UUID portfolioID);

    Optional<Holding> findByPortfolioIDAndInstrumentID(UUID portfolioID, UUID instrumentID);

    @Query("""
        SELECT h
        FROM Holding h
        WHERE h.portfolioID = :portfolioId
          AND EXISTS (
              SELECT 1
              FROM Portfolio p
              WHERE p.portfolioId = h.portfolioID
                AND p.profile.userId = :userId
          )
        """)
    List<Holding> findOwnedByPortfolioId(
        @Param("portfolioId") UUID portfolioId,
        @Param("userId") UUID userId
    );

    @Query("""
        SELECT h
        FROM Holding h
        WHERE h.holdingID = :holdingId
          AND EXISTS (
              SELECT 1
              FROM Portfolio p
              WHERE p.portfolioId = h.portfolioID
                AND p.profile.userId = :userId
          )
        """)
    Optional<Holding> findOwnedByHoldingId(
        @Param("holdingId") UUID holdingId,
        @Param("userId") UUID userId
    );

    @Modifying
    @Query("""
        DELETE FROM Holding h
        WHERE h.holdingID = :holdingId
          AND EXISTS (
              SELECT 1
              FROM Portfolio p
              WHERE p.portfolioId = h.portfolioID
                AND p.profile.userId = :userId
          )
        """)
    int deleteOwnedByHoldingId(
        @Param("holdingId") UUID holdingId,
        @Param("userId") UUID userId
    );

    @Query("""
      SELECT (COUNT(h) > 0)
      FROM Holding h
      WHERE h.portfolioID = :portfolioId
        AND h.currentQuantity > 0
        AND EXISTS (
          SELECT 1
          FROM Portfolio p
          WHERE p.portfolioId = h.portfolioID
          AND p.profile.userId = :userId
        )
      """)
    boolean existsOwnedPositiveQuantityHolding(
      @Param("portfolioId") UUID portfolioId,
      @Param("userId") UUID userId
    );
}