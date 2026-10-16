package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InstrumentRepository extends JpaRepository<Instrument, UUID> {

    List<Instrument> findByTickerContainingIgnoreCaseOrNameContainingIgnoreCaseOrderByTickerAscInstrumentIdAsc(
        String tickerQuery,
        String nameQuery
    );

    Page<Instrument> findByTickerContainingIgnoreCaseOrNameContainingIgnoreCase(
        String tickerQuery,
        String nameQuery,
        Pageable pageable
    );

    List<Instrument> findByInstrumentClassAndTickerContainingIgnoreCaseOrInstrumentClassAndNameContainingIgnoreCaseOrderByTickerAscInstrumentIdAsc(
        InstrumentClass tickerClass,
        String tickerQuery,
        InstrumentClass nameClass,
        String nameQuery
    );

    Page<Instrument> findByInstrumentClassAndTickerContainingIgnoreCaseOrInstrumentClassAndNameContainingIgnoreCase(
        InstrumentClass tickerClass,
        String tickerQuery,
        InstrumentClass nameClass,
        String nameQuery,
        Pageable pageable
    );

    Optional<Instrument> findByTickerIgnoreCase(String ticker);

    Optional<Instrument> findByTickerIgnoreCaseAndInstrumentClass(String ticker, InstrumentClass instrumentClass);

    boolean existsByTickerIgnoreCase(String ticker);
}
