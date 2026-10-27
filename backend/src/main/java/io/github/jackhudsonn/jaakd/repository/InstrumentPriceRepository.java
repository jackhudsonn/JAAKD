package io.github.jackhudsonn.jaakd.repository;

import io.github.jackhudsonn.jaakd.model.InstrumentPrice;
import io.github.jackhudsonn.jaakd.model.InstrumentPriceId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface InstrumentPriceRepository extends JpaRepository<InstrumentPrice, InstrumentPriceId> {

    List<InstrumentPrice> findByInstrumentIdAndPriceDateBetween(UUID instrumentId, LocalDate from, LocalDate to);
}
