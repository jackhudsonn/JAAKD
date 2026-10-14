package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InstrumentRepository extends JpaRepository<Instrument, UUID> {

    @Query("""
        SELECT i
        FROM Instrument i
        WHERE (:instrumentType IS NULL OR i.instrumentClass = :instrumentType)
          AND (
              UPPER(i.ticker) LIKE UPPER(CONCAT('%', :query, '%'))
              OR UPPER(i.name) LIKE UPPER(CONCAT('%', :query, '%'))
          )
        ORDER BY i.ticker ASC, i.instrumentId ASC
        """)
    List<Instrument> searchByFilters(
        @Param("instrumentType") InstrumentClass instrumentType,
        @Param("query") String query
    );

    @Query("""
        SELECT i
        FROM Instrument i
        WHERE (:instrumentType IS NULL OR i.instrumentClass = :instrumentType)
          AND (
              UPPER(i.ticker) LIKE UPPER(CONCAT('%', :query, '%'))
              OR UPPER(i.name) LIKE UPPER(CONCAT('%', :query, '%'))
          )
        ORDER BY i.ticker ASC, i.instrumentId ASC
        """)
    Page<Instrument> searchByFilters(
        @Param("instrumentType") InstrumentClass instrumentType,
        @Param("query") String query,
        Pageable pageable
    );

    Optional<Instrument> findByTickerIgnoreCase(String ticker);

    Optional<Instrument> findByTickerIgnoreCaseAndInstrumentClass(String ticker, InstrumentClass instrumentClass);

    boolean existsByTickerIgnoreCase(String ticker);
}
