package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CashConversionRequest;
import io.github.jackhudsonn.jaakd.dto.CashConversionResponse;
import io.github.jackhudsonn.jaakd.dto.LotMatchResponse;
import io.github.jackhudsonn.jaakd.dto.PositionLotResponse;
import io.github.jackhudsonn.jaakd.exception.HoldingNotFoundException;
import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.exception.PortfolioNotFoundException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.model.Portfolio;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.OrderLogRepository;
import io.github.jackhudsonn.jaakd.repository.PortfolioRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import io.github.jackhudsonn.jaakd.service.fauxnance.FauxnanceQuoteResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class HoldingService {
    private final HoldingRepository holdingRepository;
    private final PositionLotRepository positionLotRepository;
    private final LotMatchRepository lotMatchRepository;
    private final InstrumentRepository instrumentRepository;
    private final PortfolioRepository portfolioRepository;
    private final OrderLogRepository orderLogRepository;
    private final FauxnanceService fauxnanceService;
    private final CurrentUserService currentUserService;

    public HoldingService(
        HoldingRepository holdingRepository,
        PositionLotRepository positionLotRepository,
        LotMatchRepository lotMatchRepository,
        InstrumentRepository instrumentRepository,
        PortfolioRepository portfolioRepository,
        OrderLogRepository orderLogRepository,
        FauxnanceService fauxnanceService,
        CurrentUserService currentUserService
    ) {
        this.holdingRepository = holdingRepository;
        this.positionLotRepository = positionLotRepository;
        this.lotMatchRepository = lotMatchRepository;
        this.instrumentRepository = instrumentRepository;
        this.portfolioRepository = portfolioRepository;
        this.orderLogRepository = orderLogRepository;
        this.fauxnanceService = fauxnanceService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public CashConversionResponse convertCash(UUID portfolioId, CashConversionRequest request) {
        UUID userId = currentUserService.getUserId();

        Portfolio portfolio = portfolioRepository.findOwnedByPortfolioId(portfolioId, userId)
            .orElseThrow(() -> new PortfolioNotFoundException(portfolioId));

        if (request.sourceCurrency() == request.targetCurrency()) {
            throw new InvalidTradeException("Source and target currencies must be different");
        }

        BigDecimal sourceAmount = safe(request.sourceAmount());
        if (sourceAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidTradeException("Source amount must be greater than zero");
        }

        Instrument sourceCashInstrument = resolveCashInstrument(request.sourceCurrency());
        Instrument targetCashInstrument = resolveCashInstrument(request.targetCurrency());

        Holding sourceHolding = holdingRepository
            .findByPortfolioIDAndInstrumentID(portfolioId, sourceCashInstrument.getInstrumentId())
            .orElseThrow(() -> new InvalidTradeException(
                "Source cash holding is missing for currency: " + request.sourceCurrency()
            ));

        BigDecimal sourceBalance = safe(sourceHolding.getCurrentQuantity());
        if (sourceBalance.compareTo(sourceAmount) < 0) {
            throw new InvalidTradeException(
                "Insufficient source cash balance for conversion: required="
                    + sourceAmount.toPlainString()
                    + ", available="
                    + sourceBalance.toPlainString()
            );
        }

        BigDecimal conversionRate = resolveFxRate(request.sourceCurrency(), request.targetCurrency());
        BigDecimal targetAmount = sourceAmount.multiply(conversionRate).setScale(6, RoundingMode.HALF_UP);

        Holding targetHolding = holdingRepository
            .findByPortfolioIDAndInstrumentID(portfolioId, targetCashInstrument.getInstrumentId())
            .orElseGet(() -> holdingRepository.save(new Holding(portfolioId, targetCashInstrument.getInstrumentId())));

        BigDecimal targetBalance = safe(targetHolding.getCurrentQuantity());
        BigDecimal sourceBalanceAfter = sourceBalance.subtract(sourceAmount).setScale(6, RoundingMode.HALF_UP);
        BigDecimal targetBalanceAfter = targetBalance.add(targetAmount).setScale(6, RoundingMode.HALF_UP);
        LocalDateTime now = LocalDateTime.now();

        sourceHolding.setCurrentQuantity(sourceBalanceAfter);
        sourceHolding.setUpdatedAt(now);
        holdingRepository.save(sourceHolding);

        targetHolding.setCurrentQuantity(targetBalanceAfter);
        targetHolding.setUpdatedAt(now);
        holdingRepository.save(targetHolding);

        OrderLog fxAuditLog = appendFxConversionAudit(
            portfolio,
            sourceCashInstrument,
            request,
            conversionRate,
            targetAmount,
            sourceBalance,
            sourceBalanceAfter,
            targetBalance,
            targetBalanceAfter,
            now
        );

        return new CashConversionResponse(
            fxAuditLog.getOrderId(),
            fxAuditLog.getLogOrderID(),
            portfolioId,
            request.sourceCurrency(),
            request.targetCurrency(),
            sourceAmount,
            conversionRate,
            targetAmount,
            sourceBalanceAfter,
            targetBalanceAfter,
            request.metadata(),
            now
        );
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

    private Instrument resolveCashInstrument(CashCurrency currency) {
        return instrumentRepository
            .findByTickerIgnoreCaseAndInstrumentClass(currency.name(), InstrumentClass.CASH)
            .orElseThrow(() -> new InvalidTradeException("Cash instrument is not configured for currency: " + currency));
    }

    private BigDecimal resolveFxRate(CashCurrency sourceCurrency, CashCurrency targetCurrency) {
        String directSymbol = sourceCurrency.name() + targetCurrency.name();
        String inverseSymbol = targetCurrency.name() + sourceCurrency.name();

        BigDecimal directRate = resolvePositiveRate(directSymbol);
        if (directRate != null) {
            return directRate;
        }

        BigDecimal inverseRate = resolvePositiveRate(inverseSymbol);
        if (inverseRate != null && inverseRate.compareTo(BigDecimal.ZERO) > 0) {
            return BigDecimal.ONE.divide(inverseRate, 10, RoundingMode.HALF_UP);
        }

        throw new InvalidTradeException(
            "Unable to resolve FX conversion rate for pair " + directSymbol + " (or inverse " + inverseSymbol + ")"
        );
    }

    private BigDecimal resolvePositiveRate(String symbol) {
        List<FauxnanceQuoteResponse> quotes = fauxnanceService.getQuotes(List.of(symbol));
        if (quotes == null || quotes.isEmpty()) {
            return null;
        }

        FauxnanceQuoteResponse quote = quotes.get(0);
        BigDecimal price = positiveDecimal(quote.price());
        if (price != null) {
            return price;
        }

        BigDecimal bid = positiveDecimal(quote.bid());
        if (bid != null) {
            return bid;
        }

        return positiveDecimal(quote.ask());
    }

    private BigDecimal positiveDecimal(Double value) {
        if (value == null) {
            return null;
        }

        BigDecimal decimal = BigDecimal.valueOf(value);
        return decimal.compareTo(BigDecimal.ZERO) > 0 ? decimal : null;
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private OrderLog appendFxConversionAudit(
        Portfolio portfolio,
        Instrument sourceCashInstrument,
        CashConversionRequest request,
        BigDecimal conversionRate,
        BigDecimal targetAmount,
        BigDecimal sourceBalanceBefore,
        BigDecimal sourceBalanceAfter,
        BigDecimal targetBalanceBefore,
        BigDecimal targetBalanceAfter,
        LocalDateTime convertedAt
    ) {
        UUID orderId = UUID.randomUUID();
        OrderLog fxLog = new OrderLog(
            orderId,
            portfolio,
            sourceCashInstrument,
            OrderSide.FX,
            request.sourceAmount().doubleValue()
        );
        fxLog.setStatus(OrderStatus.EXECUTED);
        fxLog.setExecutionPrice(conversionRate.doubleValue());
        fxLog.setQuotedPrice(conversionRate.doubleValue());
        fxLog.setMetadata(buildFxMetadata(
            request,
            conversionRate,
            targetAmount,
            sourceBalanceBefore,
            sourceBalanceAfter,
            targetBalanceBefore,
            targetBalanceAfter,
            convertedAt
        ));

        return orderLogRepository.save(fxLog);
    }

    private String buildFxMetadata(
        CashConversionRequest request,
        BigDecimal conversionRate,
        BigDecimal targetAmount,
        BigDecimal sourceBalanceBefore,
        BigDecimal sourceBalanceAfter,
        BigDecimal targetBalanceBefore,
        BigDecimal targetBalanceAfter,
        LocalDateTime convertedAt
    ) {
        StringBuilder metadata = new StringBuilder();
        metadata.append("fxConversion=true");
        metadata.append(";sourceCurrency=").append(request.sourceCurrency());
        metadata.append(";targetCurrency=").append(request.targetCurrency());
        metadata.append(";sourceAmount=").append(request.sourceAmount().toPlainString());
        metadata.append(";conversionRate=").append(conversionRate.toPlainString());
        metadata.append(";targetAmount=").append(targetAmount.toPlainString());
        metadata.append(";sourceBalanceBefore=").append(sourceBalanceBefore.toPlainString());
        metadata.append(";sourceBalanceAfter=").append(sourceBalanceAfter.toPlainString());
        metadata.append(";targetBalanceBefore=").append(targetBalanceBefore.toPlainString());
        metadata.append(";targetBalanceAfter=").append(targetBalanceAfter.toPlainString());
        metadata.append(";convertedAt=").append(convertedAt);
        if (request.metadata() != null && !request.metadata().isBlank()) {
            metadata.append(";note=").append(request.metadata().trim());
        }
        return metadata.toString();
    }
}
