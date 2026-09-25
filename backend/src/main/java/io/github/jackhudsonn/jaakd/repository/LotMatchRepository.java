package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.LotMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface LotMatchRepository extends JpaRepository<LotMatch, UUID> {

    boolean existsBySellLogOrderID(UUID sellLogOrderID);

    List<LotMatch> findBySellLogOrderID(UUID sellLogOrderID);

        @Query("""
                SELECT lm
                FROM LotMatch lm
                WHERE lm.holdingID = :holdingId
                    AND EXISTS (
                            SELECT 1
                            FROM Holding h
                            WHERE h.holdingID = lm.holdingID
                                AND EXISTS (
                                        SELECT 1
                                        FROM Portfolio p
                                        WHERE p.portfolioId = h.portfolioID
                                            AND p.profile.userId = :userId
                                )
                    )
                ORDER BY lm.matchedAt ASC, lm.lotMatchID ASC
                """)
        List<LotMatch> findOwnedByHoldingIdOldestFirst(
                @Param("holdingId") UUID holdingId,
                @Param("userId") UUID userId
        );
}