package com.example.backend.service;

import com.example.backend.dto.CreateHoldingRequest;
import com.example.backend.dto.UpdateHoldingRequest;
import com.example.backend.model.Holding;
import com.example.backend.model.Instrument;
import com.example.backend.model.Portfolio;
import com.example.backend.repository.HoldingRepository;
import com.example.backend.repository.InstrumentRepository;
import com.example.backend.repository.PortfolioRepository;
import com.example.backend.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class HoldingService {

    private final HoldingRepository holdingRepository;
    private final PortfolioRepository portfolioRepository;
    private final InstrumentRepository instrumentRepository;
    private final CurrentUserService currentUserService;

    public HoldingService(
            HoldingRepository holdingRepository,
            PortfolioRepository portfolioRepository,
            InstrumentRepository instrumentRepository,
            CurrentUserService currentUserService
    ) {
        this.holdingRepository = holdingRepository;
        this.portfolioRepository = portfolioRepository;
        this.instrumentRepository = instrumentRepository;
        this.currentUserService = currentUserService;
    }

    public List<Holding> getHoldingsForPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        return holdingRepository.findByPortfolioPortfolioIdAndPortfolioProfileUserId(portfolioId, userId);
    }

    public Holding getHoldingById(UUID holdingId) {
        UUID userId = currentUserService.getUserId();

        Optional<Holding> maybeHolding = holdingRepository.findByHoldingIdAndPortfolioProfileUserId(holdingId, userId);
        if (maybeHolding.isEmpty()) {
            throw new IllegalArgumentException("Holding not found for id: " + holdingId);
        }

        return maybeHolding.get();
    }

    @Transactional
    public Holding createHolding(CreateHoldingRequest request) {
        // 1. Resolve current user
        UUID userId = currentUserService.getUserId();

        // 2. Ensure portfolio exists and belongs to user
        Optional<Portfolio> maybePortfolio = portfolioRepository.findByPortfolioIdAndProfileUserId(request.portfolioId(), userId);
        if (maybePortfolio.isEmpty()) {
            throw new IllegalArgumentException("Portfolio not found for id: " + request.portfolioId());
        }
        Portfolio portfolio = maybePortfolio.get();

        // 3. Ensure instrument exists
        Optional<Instrument> maybeInstrument = instrumentRepository.findById(request.instrumentId());
        if (maybeInstrument.isEmpty()) {
            throw new IllegalArgumentException("Instrument not found for id: " + request.instrumentId());
        }
        Instrument instrument = maybeInstrument.get();

        // 4. Prevent duplicate holding for same portfolio + instrument
        Optional<Holding> maybeExisting = holdingRepository
            .findOwnedByPortfolioAndInstrument(
                        request.portfolioId(),
                        request.instrumentId(),
                        userId
                );
        if (maybeExisting.isPresent()) {
            throw new IllegalArgumentException("Holding already exists for this portfolio and instrument");
        }

        // 5. Build and persist holding
        Holding holding = new Holding(portfolio, instrument, request.currentQuantity());
        return holdingRepository.save(holding);
    }

    @Transactional
    public Holding updateHolding(UUID holdingId, UpdateHoldingRequest request) {
        // 1. Load owned holding
        UUID userId = currentUserService.getUserId();
        Optional<Holding> maybeHolding = holdingRepository.findByHoldingIdAndPortfolioProfileUserId(holdingId, userId);

        if (maybeHolding.isEmpty()) {
            throw new IllegalArgumentException("Holding not found for id: " + holdingId);
        }

        Holding holding = maybeHolding.get();

        // 2. Apply updates
        if (request.currentQuantity() != null) {
            holding.setCurrentQuantity(request.currentQuantity());
        }

        // 3. Persist updates
        return holdingRepository.save(holding);
    }

    @Transactional
    public void deleteHolding(UUID holdingId) {
        // 1. Load owned holding
        UUID userId = currentUserService.getUserId();
        Optional<Holding> maybeHolding = holdingRepository.findByHoldingIdAndPortfolioProfileUserId(holdingId, userId);

        if (maybeHolding.isEmpty()) {
            throw new IllegalArgumentException("Holding not found for id: " + holdingId);
        }

        // 2. Delete
        holdingRepository.delete(maybeHolding.get());
    }
}
