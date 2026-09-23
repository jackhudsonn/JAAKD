package com.example.backend.service;

import com.example.backend.dto.CreateInstrumentRequest;
import com.example.backend.dto.UpdateInstrumentRequest;
import com.example.backend.model.Instrument;
import com.example.backend.repository.InstrumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class InstrumentService {

    private final InstrumentRepository instrumentRepository;

    public InstrumentService(InstrumentRepository instrumentRepository) {
        this.instrumentRepository = instrumentRepository;
    }

    public List<Instrument> getAllInstruments() {
        return instrumentRepository.findAll();
    }

    public Instrument getInstrumentById(UUID instrumentId) {
        return instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found for id: " + instrumentId));
    }

    public Instrument getInstrumentByTicker(String ticker) {
        return instrumentRepository.findByTickerIgnoreCase(ticker)
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found for ticker: " + ticker));
    }

    @Transactional
    public Instrument createInstrument(CreateInstrumentRequest request) {
        // 1. Prevent duplicate tickers
        if (instrumentRepository.existsByTickerIgnoreCase(request.ticker())) {
            throw new IllegalArgumentException("Instrument already exists for ticker: " + request.ticker());
        }

        // 2. Build entity
        Instrument instrument = new Instrument(
                request.ticker().trim().toUpperCase(),
                request.market().trim(),
                request.name().trim(),
                request.instrumentClass(),
                request.logoUrl(),
                request.description()
        );

        // 3. Persist entity
        return instrumentRepository.save(instrument);
    }

    @Transactional
    public Instrument updateInstrument(UUID instrumentId, UpdateInstrumentRequest request) {
        // 1. Fetch existing entity
        Instrument instrument = instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found for id: " + instrumentId));

        // 2. Update allowed fields only: name, logoUrl, description
        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new IllegalArgumentException("Instrument name cannot be blank");
            }
            instrument.setName(request.name().trim());
        }

        if (request.logoUrl() != null) {
            instrument.setLogoUrl(request.logoUrl());
        }

        if (request.description() != null) {
            instrument.setDescription(request.description());
        }

        // 3. Save updated entity
        return instrumentRepository.save(instrument);
    }

    @Transactional
    public void deleteInstrument(UUID instrumentId) {
        Instrument instrument = instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found for id: " + instrumentId));

        instrumentRepository.delete(instrument);
    }

    @Transactional
    public Instrument createOrUpdateFromExternalData(String ticker) {
        // TODO: Integrate market-data provider API once available.
        // TODO: Fetch instrument metadata by ticker and map fields.
        // TODO: Upsert instrument in local database.
        throw new UnsupportedOperationException("External instrument API is not integrated yet for ticker: " + ticker);
    }
}
