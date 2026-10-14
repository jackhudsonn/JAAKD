package io.github.jackhudsonn.jaakd.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.exception.InstrumentConflictException;
import io.github.jackhudsonn.jaakd.exception.InstrumentNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidInstrumentException;
import io.github.jackhudsonn.jaakd.exception.ValidationException;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;

import java.util.List;
import java.util.UUID;

@Service
public class InstrumentService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 25;
    private static final int MAX_SIZE = 100;

    private final InstrumentRepository instrumentRepository;
    private final PrivilegedAccessService privilegedAccessService;

    public InstrumentService(
        InstrumentRepository instrumentRepository,
        PrivilegedAccessService privilegedAccessService
    ) {
        this.instrumentRepository = instrumentRepository;
        this.privilegedAccessService = privilegedAccessService;
    }

    public List<Instrument> getAllInstruments() {
        return getAllInstruments(null, null, null, null);
    }

    public List<Instrument> getAllInstruments(
        InstrumentClass instrumentType,
        String query,
        Integer page,
        Integer size
    ) {
        String normalizedQuery = normalizeQuery(query);
        Sort sort = Sort.by(Sort.Order.asc("ticker"), Sort.Order.asc("instrumentId"));

        if (page == null && size == null) {
            if (instrumentType == null) {
                return instrumentRepository
                    .findByTickerContainingIgnoreCaseOrNameContainingIgnoreCaseOrderByTickerAscInstrumentIdAsc(
                        normalizedQuery,
                        normalizedQuery
                    );
            }

            return instrumentRepository
                .findByInstrumentClassAndTickerContainingIgnoreCaseOrInstrumentClassAndNameContainingIgnoreCaseOrderByTickerAscInstrumentIdAsc(
                    instrumentType,
                    normalizedQuery,
                    instrumentType,
                    normalizedQuery
                );
        }

        int resolvedPage = page == null ? DEFAULT_PAGE : page;
        int resolvedSize = size == null ? DEFAULT_SIZE : size;
        validatePaging(resolvedPage, resolvedSize);

        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize, sort);
        if (instrumentType == null) {
            return instrumentRepository
                .findByTickerContainingIgnoreCaseOrNameContainingIgnoreCase(normalizedQuery, normalizedQuery, pageable)
                .getContent();
        }

        return instrumentRepository
            .findByInstrumentClassAndTickerContainingIgnoreCaseOrInstrumentClassAndNameContainingIgnoreCase(
                instrumentType,
                normalizedQuery,
                instrumentType,
                normalizedQuery,
                pageable
            )
            .getContent();
    }

    public Instrument getInstrumentById(UUID instrumentId) {
        return instrumentRepository.findById(instrumentId)
                .orElseThrow(() -> new InstrumentNotFoundException(instrumentId));
    }

    public Instrument getInstrumentByTicker(String ticker) {
        return instrumentRepository.findByTickerIgnoreCase(ticker)
                .orElseThrow(() -> new InstrumentNotFoundException(ticker));
    }

    @Transactional
    public Instrument createInstrument(CreateInstrumentRequest request) {
        privilegedAccessService.ensureAdmin();

        // 1. Prevent duplicate tickers
        if (instrumentRepository.existsByTickerIgnoreCase(request.ticker())) {
            throw new InstrumentConflictException(request.ticker());
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
        privilegedAccessService.ensureAdmin();

        // 1. Fetch existing entity
        Instrument instrument = instrumentRepository.findById(instrumentId)
            .orElseThrow(() -> new InstrumentNotFoundException(instrumentId));

        // 2. Update allowed fields only: name, logoUrl, description
        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new InvalidInstrumentException("Instrument name cannot be blank");
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

    private String normalizeQuery(String query) {
        if (query == null) {
            return "";
        }

        String trimmed = query.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private void validatePaging(int page, int size) {
        if (page < 0) {
            throw new ValidationException("Page must be greater than or equal to 0");
        }

        if (size < 1 || size > MAX_SIZE) {
            throw new ValidationException("Size must be between 1 and 100");
        }
    }

}
