package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InstrumentRepository extends JpaRepository<Instrument, UUID> {

    @Query("""
        SELECT i
        FROM Instrument i
        WHERE (:instrumentClass IS NULL OR i.instrumentClass = :instrumentClass)
          AND (UPPER(i.ticker) LIKE UPPER(CONCAT('%', :query, '%'))
            OR UPPER(i.name) LIKE UPPER(CONCAT('%', :query, '%')))
        ORDER BY i.ticker ASC, i.instrumentId ASC
        """)
    List<Instrument> findBySearchQueryAndOptionalInstrumentClass(
        @Param("query") String query,
        @Param("instrumentClass") InstrumentClass instrumentClass
    );

    @Query("""
        SELECT i
        FROM Instrument i
        WHERE (:instrumentClass IS NULL OR i.instrumentClass = :instrumentClass)
          AND (UPPER(i.ticker) LIKE UPPER(CONCAT('%', :query, '%'))
            OR UPPER(i.name) LIKE UPPER(CONCAT('%', :query, '%')))
        """)
    Page<Instrument> findBySearchQueryAndOptionalInstrumentClass(
        @Param("query") String query,
        @Param("instrumentClass") InstrumentClass instrumentClass,
        Pageable pageable
    );

    Optional<Instrument> findByTickerIgnoreCase(String ticker);

    Optional<Instrument> findByTickerIgnoreCaseAndInstrumentClass(String ticker, InstrumentClass instrumentClass);

    boolean existsByTickerIgnoreCase(String ticker);
}
