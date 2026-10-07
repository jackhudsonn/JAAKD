package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.jackhudsonn.jaakd.model.Instrument;

import java.util.Optional;
import java.util.UUID;

public interface InstrumentRepository extends JpaRepository<Instrument, UUID> {

    

    Optional<Instrument> findByTickerIgnoreCase(String ticker);

    boolean existsByTickerIgnoreCase(String ticker);
}
