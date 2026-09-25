package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.exception.HoldingNotFoundException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class HoldingService {
    private final HoldingRepository holdingRepository;
    private final PositionLotRepository positionLotRepository;
    private final LotMatchRepository lotMatchRepository;
    private final CurrentUserService currentUserService;

    public HoldingService(
        HoldingRepository holdingRepository,
        PositionLotRepository positionLotRepository,
        LotMatchRepository lotMatchRepository,
        CurrentUserService currentUserService
    ) {
        this.holdingRepository = holdingRepository;
        this.positionLotRepository = positionLotRepository;
        this.lotMatchRepository = lotMatchRepository;
        this.currentUserService = currentUserService;
    }

    public List<Holding> getHoldingsForPortfolio(UUID portfolioId) {
        UUID userId = currentUserService.getUserId();
        return holdingRepository.findOwnedByPortfolioId(portfolioId, userId);
    }

    public Holding getHoldingById(UUID holdingId) {
        UUID userId = currentUserService.getUserId();
        return holdingRepository.findOwnedByHoldingId(holdingId, userId)
            .orElseThrow(() -> new HoldingNotFoundException(holdingId));
    }

    public List<PositionLotResponse> getPositionLotsForHolding(UUID holdingId) {
        Holding holding = getHoldingById(holdingId);
        UUID userId = currentUserService.getUserId();

        List<PositionLot> positionLots = positionLotRepository.findOwnedByHoldingIdOldestFirst(
            holding.getHoldingID(),
            userId
        );

        List<PositionLotResponse> responses = new ArrayList<>();
        for (PositionLot positionLot : positionLots) {
            responses.add(toPositionLotResponse(positionLot));
        }

        return responses;
    }

    public List<LotMatchResponse> getLotMatchesForHolding(UUID holdingId) {
        Holding holding = getHoldingById(holdingId);
        UUID userId = currentUserService.getUserId();

        List<LotMatch> lotMatches = lotMatchRepository.findOwnedByHoldingIdOldestFirst(
            holding.getHoldingID(),
            userId
        );

        List<LotMatchResponse> responses = new ArrayList<>();
        for (LotMatch lotMatch : lotMatches) {
            responses.add(toLotMatchResponse(lotMatch));
        }

        return responses;
    }

    private PositionLotResponse toPositionLotResponse(PositionLot positionLot) {
        return new PositionLotResponse(
            positionLot.getPositionLotID(),
            positionLot.getHoldingID(),
            positionLot.getSourceBuyLogOrderID(),
            positionLot.getOpenedAt(),
            positionLot.getOriginalQuantity(),
            positionLot.getRemainingQuantity(),
            positionLot.getUnitCost()
        );
    }

    private LotMatchResponse toLotMatchResponse(LotMatch lotMatch) {
        return new LotMatchResponse(
            lotMatch.getLotMatchID(),
            lotMatch.getSellLogOrderID(),
            lotMatch.getPositionLotID(),
            lotMatch.getHoldingID(),
            lotMatch.getMatchedQuantity(),
            lotMatch.getSellUnitPrice(),
            lotMatch.getRealizedPnlAmount(),
            lotMatch.getMatchedAt()
        );
    }
}
