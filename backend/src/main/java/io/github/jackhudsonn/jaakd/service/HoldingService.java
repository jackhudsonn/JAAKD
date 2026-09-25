package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.HoldingNotFoundException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class HoldingService {
    private final HoldingRepository holdingRepository;
    private final CurrentUserService currentUserService;

    public HoldingService(
        HoldingRepository holdingRepository,
        CurrentUserService currentUserService
    ) {
        this.holdingRepository = holdingRepository;
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

    @Transactional
    public void deleteHolding(UUID holdingId) {
        UUID userId = currentUserService.getUserId();
        int deleted = holdingRepository.deleteOwnedByHoldingId(holdingId, userId);
        if (deleted == 0) {
            throw new HoldingNotFoundException(holdingId);
        }
    }
}
