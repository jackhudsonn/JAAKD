package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class FifoAccountingService {

    private final HoldingRepository holdingRepository;
    private final PositionLotRepository positionLotRepository;
    private final LotMatchRepository lotMatchRepository;

    public FifoAccountingService(
        HoldingRepository holdingRepository,
        PositionLotRepository positionLotRepository,
        LotMatchRepository lotMatchRepository
    ) {
        this.holdingRepository = holdingRepository;
        this.positionLotRepository = positionLotRepository;
        this.lotMatchRepository = lotMatchRepository;
    }

    public void applyExecution(OrderLog orderLog) {
        if (orderLog.getStatus() != OrderStatus.EXECUTED) {
            return;
        }

        if (orderLog.getSide() == OrderSide.BUY) {
            applyBuy(orderLog);
            return;
        }

        if (orderLog.getSide() == OrderSide.SELL) {
            applySell(orderLog);
            return;
        }

        if (orderLog.getSide() == OrderSide.DEPOSIT) {
            applyDeposit(orderLog);
            return;
        }

        if (orderLog.getSide() == OrderSide.WITHDRAW) {
            applyWithdraw(orderLog);
            return;
        }

        throw new InvalidTradeException("Unsupported FIFO side: " + orderLog.getSide());
    }

    private void applyBuy(OrderLog orderLog) {
        UUID buyLogId = orderLog.getLogOrderID();
        if (positionLotRepository.existsBySourceBuyLogOrderID(buyLogId)) {
            return;
        }

        Holding holding = resolveOrCreateHolding(orderLog);

        BigDecimal quantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal unitCost = BigDecimal.valueOf(orderLog.getExecutionPrice());

        PositionLot lot = new PositionLot(
            holding.getHoldingID(),
            buyLogId,
            orderLog.getTimeStamp(),
            quantity,
            quantity,
            unitCost
        );
        positionLotRepository.save(lot);

        BigDecimal currentQuantity = safe(holding.getCurrentQuantity());
        holding.setCurrentQuantity(currentQuantity.add(quantity));
        holding.setUpdatedAt(ZonedDateTime.now());
        holdingRepository.save(holding);
    }

    private void applySell(OrderLog orderLog) {
        UUID sellLogId = orderLog.getLogOrderID();
        if (lotMatchRepository.existsBySellLogOrderID(sellLogId)) {
            return;
        }

        Holding holding = resolveExistingHolding(orderLog);

        BigDecimal sellQuantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal sellUnitPrice = BigDecimal.valueOf(orderLog.getExecutionPrice());

        BigDecimal currentQuantity = safe(holding.getCurrentQuantity());
        if (currentQuantity.compareTo(sellQuantity) < 0) {
            throw new InvalidTradeException("Cannot sell more than current holding quantity");
        }

        List<PositionLot> openLots = positionLotRepository
            .findByHoldingIDAndRemainingQuantityGreaterThanOrderByOpenedAtAscPositionLotIDAsc(
                holding.getHoldingID(),
                BigDecimal.ZERO
            );

        BigDecimal remainingToSell = sellQuantity;
        BigDecimal realizedTotal = BigDecimal.ZERO;

        for (PositionLot lot : openLots) {
            if (remainingToSell.compareTo(BigDecimal.ZERO) == 0) {
                break;
            }

            BigDecimal lotRemaining = safe(lot.getRemainingQuantity());
            if (lotRemaining.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            BigDecimal matched = remainingToSell.min(lotRemaining);
            BigDecimal realized = sellUnitPrice.subtract(lot.getUnitCost()).multiply(matched);

            LotMatch lotMatch = new LotMatch(
                sellLogId,
                lot.getPositionLotID(),
                holding.getHoldingID(),
                matched,
                sellUnitPrice,
                realized,
                orderLog.getTimeStamp()
            );
            lotMatchRepository.save(lotMatch);

            lot.setRemainingQuantity(lotRemaining.subtract(matched));
            positionLotRepository.save(lot);

            realizedTotal = realizedTotal.add(realized);
            remainingToSell = remainingToSell.subtract(matched);
        }

        if (remainingToSell.compareTo(BigDecimal.ZERO) > 0) {
            throw new InvalidTradeException("Cannot sell more than current holding quantity");
        }

        holding.setCurrentQuantity(currentQuantity.subtract(sellQuantity));
        holding.setCumulativeRealizedPnl(safe(holding.getCumulativeRealizedPnl()).add(realizedTotal));
        holding.setUpdatedAt(ZonedDateTime.now());
        holdingRepository.save(holding);
    }

    private void applyDeposit(OrderLog orderLog) {
        Holding holding = resolveOrCreateHolding(orderLog);
        BigDecimal depositQuantity = BigDecimal.valueOf(orderLog.getQuantity());

        holding.setCurrentQuantity(safe(holding.getCurrentQuantity()).add(depositQuantity));
        holding.setUpdatedAt(ZonedDateTime.now());
        holdingRepository.save(holding);
    }

    private void applyWithdraw(OrderLog orderLog) {
        Holding holding = resolveExistingHolding(orderLog);
        BigDecimal withdrawQuantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal currentQuantity = safe(holding.getCurrentQuantity());

        if (currentQuantity.compareTo(withdrawQuantity) < 0) {
            throw new InvalidTradeException("Cannot withdraw more than current cash quantity");
        }

        holding.setCurrentQuantity(currentQuantity.subtract(withdrawQuantity));
        holding.setUpdatedAt(ZonedDateTime.now());
        holdingRepository.save(holding);
    }

    private Holding resolveOrCreateHolding(OrderLog orderLog) {
        UUID portfolioId = orderLog.getPortfolio().getPortfolioId();
        UUID instrumentId = orderLog.getInstrument().getInstrumentId();

        return holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)
            .orElseGet(() -> holdingRepository.save(new Holding(portfolioId, instrumentId)));
    }

    private Holding resolveExistingHolding(OrderLog orderLog) {
        UUID portfolioId = orderLog.getPortfolio().getPortfolioId();
        UUID instrumentId = orderLog.getInstrument().getInstrumentId();

        return holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, instrumentId)
            .orElseThrow(() -> new InvalidTradeException("Cannot sell without an existing holding"));
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}