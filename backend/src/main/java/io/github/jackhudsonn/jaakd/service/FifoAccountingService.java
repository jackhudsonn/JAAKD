package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.LotMatch;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.model.PositionLot;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import static java.lang.Thread.sleep;

@Service
public class FifoAccountingService {

    private static final String[] CASH_TICKER_PRIORITY = {"USD", "GBP", "RUP"};
    private static final String REASON_CASH_INSTRUMENT_NOT_CONFIGURED = "Cash instrument is not configured";
    private static final String REASON_INSUFFICIENT_BUY_CASH = "Cannot buy more than current cash quantity";

    public record ExecutionOutcome(boolean succeeded, String failureReason, Double executionPriceUsed) {
        public static ExecutionOutcome success(Double executionPriceUsed) {
            return new ExecutionOutcome(true, null, executionPriceUsed);
        }

        public static ExecutionOutcome failed(String failureReason) {
            return new ExecutionOutcome(false, failureReason, null);
        }
    }

    private final HoldingRepository holdingRepository;
    private final InstrumentRepository instrumentRepository;
    private final PositionLotRepository positionLotRepository;
    private final LotMatchRepository lotMatchRepository;
    private final QuoteService quoteService;

    public FifoAccountingService(
        HoldingRepository holdingRepository,
        InstrumentRepository instrumentRepository,
        PositionLotRepository positionLotRepository,
        LotMatchRepository lotMatchRepository,
        QuoteService quoteService
    ) {
        this.holdingRepository = holdingRepository;
        this.instrumentRepository = instrumentRepository;
        this.positionLotRepository = positionLotRepository;
        this.lotMatchRepository = lotMatchRepository;
        this.quoteService = quoteService;
    }

    // Execution pricing is resolved internally via QuoteService for BUY/SELL.
    public ExecutionOutcome applyExecution(OrderLog orderLog) {
        if (orderLog.getStatus() != OrderStatus.ACCEPTED) {
            return ExecutionOutcome.failed("Order must be ACCEPTED before execution accounting");
        }

        Double effectiveExecutionPrice = null;
        if (orderLog.getSide() == OrderSide.BUY || orderLog.getSide() == OrderSide.SELL) {
            effectiveExecutionPrice = quoteService.getExecutionPrice(orderLog.getInstrument().getInstrumentId());
        }

        if ((orderLog.getSide() == OrderSide.BUY || orderLog.getSide() == OrderSide.SELL)
            && effectiveExecutionPrice == null) {
            return ExecutionOutcome.failed("Execution price is required for BUY/SELL execution");
        }

        // Simulate processing delay of 2-3 seconds during execution by sleeping for a random duration
        try {
            sleep(2000 + (int)(Math.random() * 1000));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        try {
            switch (orderLog.getSide()) {
                case BUY -> applyBuy(orderLog, effectiveExecutionPrice);
                case SELL -> applySell(orderLog, effectiveExecutionPrice);
                case DEPOSIT -> applyDeposit(orderLog);
                case WITHDRAW -> applyWithdraw(orderLog);
                default -> throw new InvalidTradeException("Unsupported FIFO side: " + orderLog.getSide());
            }
            return ExecutionOutcome.success(effectiveExecutionPrice);
        } catch (InvalidTradeException ex) {
            return ExecutionOutcome.failed(ex.getMessage());
        } catch (RuntimeException ex) {
            return ExecutionOutcome.failed("Execution pricing unavailable: " + ex.getMessage());
        }
    }

    private void applyBuy(OrderLog orderLog, Double executionPrice) {
        UUID buyLogId = orderLog.getLogOrderID();
        if (positionLotRepository.existsBySourceBuyLogOrderID(buyLogId)) {
            return;
        }

        Holding holding = resolveOrCreateHolding(orderLog);

        BigDecimal quantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal unitCost = BigDecimal.valueOf(executionPrice);

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
        holding.setUpdatedAt(LocalDateTime.now());
        holdingRepository.save(holding);

        Holding cashHolding = resolveOrCreateCashHolding(orderLog);
        BigDecimal tradeNotional = quantity.multiply(unitCost);
        BigDecimal currentCash = safe(cashHolding.getCurrentQuantity());
        if (currentCash.compareTo(tradeNotional) < 0) {
            throw new InvalidTradeException(REASON_INSUFFICIENT_BUY_CASH);
        }

        cashHolding.setCurrentQuantity(currentCash.subtract(tradeNotional));
        cashHolding.setUpdatedAt(LocalDateTime.now());
        holdingRepository.save(cashHolding);
    }

    private void applySell(OrderLog orderLog, Double executionPrice) {
        UUID sellLogId = orderLog.getLogOrderID();
        if (lotMatchRepository.existsBySellLogOrderID(sellLogId)) {
            return;
        }

        Holding holding = resolveExistingHolding(orderLog);

        BigDecimal sellQuantity = BigDecimal.valueOf(orderLog.getQuantity());
        BigDecimal sellUnitPrice = BigDecimal.valueOf(executionPrice);

        BigDecimal currentQuantity = safe(holding.getCurrentQuantity());
        if (currentQuantity.compareTo(sellQuantity) < 0) {
            throw new InvalidTradeException("Cannot sell more than current holding quantity");
        }

        List<PositionLot> openLots = positionLotRepository
            .findPositionLotsByHoldingIDWithSufficientQuantity(
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
        holding.setUpdatedAt(LocalDateTime.now());
        holdingRepository.save(holding);

        Holding cashHolding = resolveOrCreateCashHolding(orderLog);
        BigDecimal currentCash = safe(cashHolding.getCurrentQuantity());
        BigDecimal tradeNotional = sellQuantity.multiply(sellUnitPrice);
        cashHolding.setCurrentQuantity(currentCash.add(tradeNotional));
        cashHolding.setUpdatedAt(LocalDateTime.now());
        holdingRepository.save(cashHolding);
    }

    private void applyDeposit(OrderLog orderLog) {
        Holding holding = resolveOrCreateHolding(orderLog);
        BigDecimal depositQuantity = BigDecimal.valueOf(orderLog.getQuantity());

        holding.setCurrentQuantity(safe(holding.getCurrentQuantity()).add(depositQuantity));
        holding.setUpdatedAt(LocalDateTime.now());
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
        holding.setUpdatedAt(LocalDateTime.now());
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

    private Holding resolveOrCreateCashHolding(OrderLog orderLog) {
        UUID portfolioId = orderLog.getPortfolio().getPortfolioId();
        Instrument cashInstrument = resolveCashInstrument();

        return holdingRepository.findByPortfolioIDAndInstrumentID(portfolioId, cashInstrument.getInstrumentId())
            .orElseGet(() -> holdingRepository.save(new Holding(portfolioId, cashInstrument.getInstrumentId())));
    }

    private Instrument resolveCashInstrument() {
        for (String ticker : CASH_TICKER_PRIORITY) {
            Instrument found = instrumentRepository
                .findByTickerIgnoreCaseAndInstrumentClass(ticker, InstrumentClass.CASH)
                .orElse(null);
            if (found != null) {
                return found;
            }
        }

        throw new InvalidTradeException(REASON_CASH_INSTRUMENT_NOT_CONFIGURED);
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
