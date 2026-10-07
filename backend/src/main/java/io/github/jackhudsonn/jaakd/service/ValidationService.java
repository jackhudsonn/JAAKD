package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.config.KafkaTopics;
import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.event.OrderRejectedEvent;
import io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent;
import io.github.jackhudsonn.jaakd.model.Holding;
import io.github.jackhudsonn.jaakd.model.Instrument;
import io.github.jackhudsonn.jaakd.model.InstrumentClass;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderSide;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.repository.HoldingRepository;
import io.github.jackhudsonn.jaakd.repository.InstrumentRepository;
import io.github.jackhudsonn.jaakd.repository.LotMatchRepository;
import io.github.jackhudsonn.jaakd.repository.PositionLotRepository;
import io.github.jackhudsonn.jaakd.util.SimulateDelay;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
/**
 * Validation lifecycle contract (Phase 1):
 * 1) Orders are submitted as SUBMITTED.
 * 2) Validation service performs trade checks and returns ACCEPTED or REJECTED.
 * 3) CANCELLED is a terminal state for validation appends in later phases.
 * 4) ACCEPTED remains best-effort and does not guarantee eventual execution.
 */
public class ValidationService {
    private static final String[] CASH_TICKER_PRIORITY = {"USD", "GBP", "RUP"};
    private static final String REASON_NON_POSITIVE_QUANTITY = "Quantity must be greater than zero";
    private static final String REASON_CASH_INSTRUMENT_NOT_CONFIGURED = "Cash instrument is not configured";
    private static final String REASON_HOLDING_REQUIRED_FOR_BUY = "Cannot buy without an existing cash holding";
    private static final String REASON_INSUFFICIENT_BUY_CASH = "Cannot buy more than current cash quantity";
    private static final String REASON_BUY_PRICE_UNAVAILABLE = "Cannot validate BUY cash requirement without a positive price";
    private static final String REASON_HOLDING_REQUIRED_FOR_SELL = "Cannot sell without an existing holding";
    private static final String REASON_HOLDING_REQUIRED_FOR_WITHDRAW = "Cannot withdraw without an existing holding";
    private static final String REASON_INSUFFICIENT_SELL_QUANTITY = "Cannot sell more than current holding quantity";
    private static final String REASON_INSUFFICIENT_OPEN_LOTS = "Cannot sell more than open lot quantity";
    private static final String REASON_INSUFFICIENT_WITHDRAW_QUANTITY = "Cannot withdraw more than current cash quantity";
    private static final String REASON_DUPLICATE_MATCHED_SELL = "Sell order has already been lot-matched";

    private final HoldingRepository holdingRepository;
    private final InstrumentRepository instrumentRepository;
    private final PositionLotRepository positionLotRepository;
    private final LotMatchRepository lotMatchRepository;
    private final ValidationLifecycleTxService validationLifecycleTxService;
    private final KafkaTemplate<String, OrderAcceptedEvent> orderAcceptedKafkaTemplate;
    private final KafkaTemplate<String, OrderRejectedEvent> orderRejectedKafkaTemplate;
    private final SimulateDelay simulateDelay;

    public ValidationService(
        HoldingRepository holdingRepository,
        InstrumentRepository instrumentRepository,
        PositionLotRepository positionLotRepository,
        LotMatchRepository lotMatchRepository,
        ValidationLifecycleTxService validationLifecycleTxService,
        KafkaTemplate<String, OrderAcceptedEvent> orderAcceptedKafkaTemplate,
        KafkaTemplate<String, OrderRejectedEvent> orderRejectedKafkaTemplate,
        SimulateDelay simulateDelay
    ) {
        this.holdingRepository = holdingRepository;
        this.instrumentRepository = instrumentRepository;
        this.positionLotRepository = positionLotRepository;
        this.lotMatchRepository = lotMatchRepository;
        this.validationLifecycleTxService = validationLifecycleTxService;
        this.orderAcceptedKafkaTemplate = orderAcceptedKafkaTemplate;
        this.orderRejectedKafkaTemplate = orderRejectedKafkaTemplate;
        this.simulateDelay = simulateDelay;
    }

    public void handleOrderSubmitted(OrderSubmittedEvent event) {
        if (event == null) {
            return;
        }

        OrderLog pending = validationLifecycleTxService.appendPending(event.orderId(), event.logOrderId());
        if (pending.getStatus() != OrderStatus.PENDING) {
            return;
        }

        // Simulate Processing Delay
        try {
            simulateDelay.simulateMarketActivityDelay();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Validation delay interrupted", e);
        }

        String rejectionReason = validateTrade(event, pending);
        if (rejectionReason != null) {
            OrderLog rejected = validationLifecycleTxService.appendRejected(
                event.orderId(),
                event.logOrderId(),
                rejectionReason
            );
            if (rejected.getStatus() != OrderStatus.REJECTED) {
                return;
            }

            OrderRejectedEvent rejectedEvent = new OrderRejectedEvent(
                rejected.getOrderId(),
                rejected.getLogOrderID(),
                rejectionReason,
                LocalDateTime.now(),
                event.version()
            );
            String rejectedPartitionKey = rejected.getInstrument().getTicker();
            orderRejectedKafkaTemplate.send(KafkaTopics.ORDER_REJECTED, rejectedPartitionKey, rejectedEvent);
            return;
        }

        OrderLog accepted = validationLifecycleTxService.appendAccepted(event.orderId(), event.logOrderId());
        if (accepted.getStatus() != OrderStatus.ACCEPTED) {
            return;
        }

        OrderAcceptedEvent acceptedEvent = new OrderAcceptedEvent(
            accepted.getOrderId(),
            accepted.getLogOrderID(),
            LocalDateTime.now(),
            event.version()
        );
        String acceptedPartitionKey = accepted.getInstrument().getTicker();
        orderAcceptedKafkaTemplate.send(KafkaTopics.ORDER_ACCEPTED, acceptedPartitionKey, acceptedEvent);
    }

    private String validateTrade(OrderSubmittedEvent event, OrderLog pendingOrderLog) {
        if (event.quantity() <= 0) {
            return REASON_NON_POSITIVE_QUANTITY;
        }

        return switch (event.side()) {
            case BUY -> validateBuy(event, pendingOrderLog);
            case DEPOSIT -> null;
            case WITHDRAW -> validateWithdraw(event);
            case SELL -> validateSell(event);
        };
    }

    private String validateBuy(OrderSubmittedEvent event, OrderLog pendingOrderLog) {
        Optional<Instrument> maybeCashInstrument = resolveCashInstrument();
        if (maybeCashInstrument.isEmpty()) {
            return REASON_CASH_INSTRUMENT_NOT_CONFIGURED;
        }

        Optional<Holding> maybeCashHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            event.portfolioId(),
            maybeCashInstrument.get().getInstrumentId()
        );
        if (maybeCashHolding.isEmpty()) {
            return REASON_HOLDING_REQUIRED_FOR_BUY;
        }

        BigDecimal unitPrice = resolveBuyUnitPrice(pendingOrderLog);
        if (unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return REASON_BUY_PRICE_UNAVAILABLE;
        }

        BigDecimal buyQuantity = BigDecimal.valueOf(event.quantity());
        BigDecimal requiredCash = buyQuantity.multiply(unitPrice);
        BigDecimal currentCash = safe(maybeCashHolding.get().getCurrentQuantity());

        if (currentCash.compareTo(requiredCash) < 0) {
            return REASON_INSUFFICIENT_BUY_CASH;
        }

        return null;
    }

    private Optional<Instrument> resolveCashInstrument() {
        for (String ticker : CASH_TICKER_PRIORITY) {
            Optional<Instrument> found = instrumentRepository
                .findByTickerIgnoreCaseAndInstrumentClass(ticker, InstrumentClass.CASH);
            if (found.isPresent()) {
                return found;
            }
        }

        return Optional.empty();
    }

    private String validateWithdraw(OrderSubmittedEvent event) {
        Optional<Holding> maybeHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            event.portfolioId(),
            event.instrumentId()
        );
        if (maybeHolding.isEmpty()) {
            return REASON_HOLDING_REQUIRED_FOR_WITHDRAW;
        }

        BigDecimal withdrawQuantity = BigDecimal.valueOf(event.quantity());
        BigDecimal currentQuantity = safe(maybeHolding.get().getCurrentQuantity());
        if (currentQuantity.compareTo(withdrawQuantity) < 0) {
            return REASON_INSUFFICIENT_WITHDRAW_QUANTITY;
        }

        return null;
    }

    private String validateSell(OrderSubmittedEvent event) {
        if (lotMatchRepository.existsBySellLogOrderID(event.logOrderId())) {
            return REASON_DUPLICATE_MATCHED_SELL;
        }

        Optional<Holding> maybeHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            event.portfolioId(),
            event.instrumentId()
        );
        if (maybeHolding.isEmpty()) {
            return REASON_HOLDING_REQUIRED_FOR_SELL;
        }

        Holding holding = maybeHolding.get();
        BigDecimal sellQuantity = BigDecimal.valueOf(event.quantity());
        BigDecimal currentQuantity = safe(holding.getCurrentQuantity());
        if (currentQuantity.compareTo(sellQuantity) < 0) {
            return REASON_INSUFFICIENT_SELL_QUANTITY;
        }

        BigDecimal openLotQuantity = safe(
            positionLotRepository.sumOpenRemainingQuantityByHoldingID(holding.getHoldingID())
        );

        if (openLotQuantity.compareTo(sellQuantity) < 0) {
            return REASON_INSUFFICIENT_OPEN_LOTS;
        }

        return null;
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal resolveBuyUnitPrice(OrderLog orderLog) {
        if (orderLog.getExecutionPrice() > 0) {
            return BigDecimal.valueOf(orderLog.getExecutionPrice());
        }
        Double quotedPrice = orderLog.getQuotedPrice();
        if (quotedPrice != null && quotedPrice > 0) {
            return BigDecimal.valueOf(quotedPrice);
        }
        return BigDecimal.ZERO;
    }

}
