package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.config.KafkaTopics;
import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.event.OrderRejectedEvent;
import io.github.jackhudsonn.jaakd.event.OrderSubmittedEvent;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
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
    private static final String REASON_NON_POSITIVE_QUANTITY = "Quantity must be greater than zero";
    private static final String REASON_CASH_INSTRUMENT_NOT_CONFIGURED = "Cash instrument is not configured for required currency";
    private static final String REASON_HOLDING_REQUIRED_FOR_BUY = "Cannot buy without an existing cash holding";
    private static final String REASON_INSUFFICIENT_BUY_CASH = "Cannot buy more than current cash quantity";
    private static final String REASON_BUY_PRICE_UNAVAILABLE = "Cannot validate BUY cash requirement without a positive price";
    private static final String REASON_TRADING_CURRENCY_MISSING = "Instrument trading currency is missing";
    private static final String REASON_HOLDING_REQUIRED_FOR_SELL = "Cannot sell without an existing holding";
    private static final String REASON_HOLDING_REQUIRED_FOR_WITHDRAW = "Cannot withdraw without an existing holding";
    private static final String REASON_INSUFFICIENT_SELL_QUANTITY = "Cannot sell more than current holding quantity";
    private static final String REASON_INSUFFICIENT_OPEN_LOTS = "Cannot sell more than open lot quantity";
    private static final String REASON_INSUFFICIENT_WITHDRAW_QUANTITY = "Cannot withdraw more than current cash quantity";
    private static final String REASON_DUPLICATE_MATCHED_SELL = "Sell order has already been lot-matched";
    private static final String REASON_FX_NOT_ENABLED = "FX orders are not enabled yet";
    private static final String REASON_INTERNAL_VALIDATION_ERROR = "Validation processing error";
    private static final String CODE_NON_POSITIVE_QUANTITY = "NON_POSITIVE_QUANTITY";
    private static final String CODE_CASH_INSTRUMENT_NOT_CONFIGURED = "CASH_INSTRUMENT_NOT_CONFIGURED";
    private static final String CODE_HOLDING_REQUIRED_FOR_BUY = "HOLDING_REQUIRED_FOR_BUY";
    private static final String CODE_INSUFFICIENT_BUY_CASH = "INSUFFICIENT_BUY_CASH";
    private static final String CODE_BUY_PRICE_UNAVAILABLE = "BUY_PRICE_UNAVAILABLE";
    private static final String CODE_HOLDING_REQUIRED_FOR_SELL = "HOLDING_REQUIRED_FOR_SELL";
    private static final String CODE_HOLDING_REQUIRED_FOR_WITHDRAW = "HOLDING_REQUIRED_FOR_WITHDRAW";
    private static final String CODE_INSUFFICIENT_SELL_QUANTITY = "INSUFFICIENT_SELL_QUANTITY";
    private static final String CODE_INSUFFICIENT_OPEN_LOTS = "INSUFFICIENT_OPEN_LOTS";
    private static final String CODE_INSUFFICIENT_WITHDRAW_QUANTITY = "INSUFFICIENT_WITHDRAW_QUANTITY";
    private static final String CODE_DUPLICATE_MATCHED_SELL = "DUPLICATE_MATCHED_SELL";
    private static final String CODE_FX_NOT_ENABLED = "FX_NOT_ENABLED";
    private static final String CODE_TRADING_CURRENCY_MISSING = "TRADING_CURRENCY_MISSING";
    private static final String CODE_INTERNAL_VALIDATION_ERROR = "INTERNAL_VALIDATION_ERROR";

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

        try {
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

            RejectionDecision rejection = validateTrade(event, pending);
            if (rejection != null) {
                publishRejected(event, rejection);
                return;
            }

            OrderLog accepted = validationLifecycleTxService.appendAccepted(event.orderId(), event.logOrderId());
            if (accepted.getStatus() != OrderStatus.ACCEPTED) {
                return;
            }

            OrderAcceptedEvent acceptedEvent = new OrderAcceptedEvent(
                accepted.getOrderId(),
                accepted.getLogOrderID(),
                LocalDateTime.now()
            );
            String acceptedPartitionKey = accepted.getInstrument().getTicker();
            orderAcceptedKafkaTemplate.send(KafkaTopics.ORDER_ACCEPTED, acceptedPartitionKey, acceptedEvent);
        } catch (RuntimeException ex) {
            String reason = ex.getMessage() == null || ex.getMessage().isBlank()
                ? REASON_INTERNAL_VALIDATION_ERROR
                : ex.getMessage();
            publishRejected(event, RejectionDecision.simple(reason, CODE_INTERNAL_VALIDATION_ERROR));
        }
    }

    private void publishRejected(OrderSubmittedEvent event, RejectionDecision rejection) {
        String rejectionReason = rejection.reason();
        OrderLog rejected = validationLifecycleTxService.appendRejected(
            event.orderId(),
            event.logOrderId(),
            rejectionReason,
            rejection.toMetadataDetails()
        );
        if (rejected.getStatus() != OrderStatus.REJECTED) {
            return;
        }

        OrderRejectedEvent rejectedEvent = new OrderRejectedEvent(
            rejected.getOrderId(),
            rejected.getLogOrderID(),
            rejectionReason,
            rejection.reasonCode(),
            rejection.requiredCurrency(),
            rejection.requiredAmount(),
            rejection.availableAmount(),
            rejection.shortfall(),
            LocalDateTime.now()
        );
        String rejectedPartitionKey = rejected.getInstrument().getTicker();
        orderRejectedKafkaTemplate.send(KafkaTopics.ORDER_REJECTED, rejectedPartitionKey, rejectedEvent);
    }

    private RejectionDecision validateTrade(OrderSubmittedEvent event, OrderLog pendingOrderLog) {
        if (event.quantity() <= 0) {
            return RejectionDecision.simple(REASON_NON_POSITIVE_QUANTITY, CODE_NON_POSITIVE_QUANTITY);
        }

        return switch (event.side()) {
            case BUY -> validateBuy(event, pendingOrderLog);
            case DEPOSIT -> null;
            case WITHDRAW -> validateWithdraw(event);
            case SELL -> validateSell(event);
            case FX -> RejectionDecision.simple(REASON_FX_NOT_ENABLED, CODE_FX_NOT_ENABLED);
        };
    }

    private RejectionDecision validateBuy(OrderSubmittedEvent event, OrderLog pendingOrderLog) {
        CashCurrency requiredCurrency = resolveRequiredTradingCurrency(event, pendingOrderLog);
        if (requiredCurrency == null) {
            return RejectionDecision.simple(REASON_TRADING_CURRENCY_MISSING, CODE_TRADING_CURRENCY_MISSING);
        }

        Optional<Instrument> maybeCashInstrument = resolveCashInstrument(requiredCurrency);
        if (maybeCashInstrument.isEmpty()) {
            return RejectionDecision.simple(
                REASON_CASH_INSTRUMENT_NOT_CONFIGURED + ": " + requiredCurrency,
                CODE_CASH_INSTRUMENT_NOT_CONFIGURED,
                requiredCurrency.name(),
                null,
                null,
                null
            );
        }

        Optional<Holding> maybeCashHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            event.portfolioId(),
            maybeCashInstrument.get().getInstrumentId()
        );
        if (maybeCashHolding.isEmpty()) {
            return RejectionDecision.simple(REASON_HOLDING_REQUIRED_FOR_BUY, CODE_HOLDING_REQUIRED_FOR_BUY);
        }

        BigDecimal unitPrice = resolveBuyUnitPrice(pendingOrderLog);
        if (unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return RejectionDecision.simple(REASON_BUY_PRICE_UNAVAILABLE, CODE_BUY_PRICE_UNAVAILABLE);
        }

        BigDecimal buyQuantity = BigDecimal.valueOf(event.quantity());
        BigDecimal requiredCash = buyQuantity.multiply(unitPrice);
        BigDecimal currentCash = safe(maybeCashHolding.get().getCurrentQuantity());

        if (currentCash.compareTo(requiredCash) < 0) {
            return RejectionDecision.simple(
                REASON_INSUFFICIENT_BUY_CASH,
                CODE_INSUFFICIENT_BUY_CASH,
                requiredCurrency.name(),
                requiredCash,
                currentCash,
                requiredCash.subtract(currentCash)
            );
        }

        return null;
    }

    private CashCurrency resolveRequiredTradingCurrency(OrderSubmittedEvent event, OrderLog pendingOrderLog) {
        if (pendingOrderLog != null && pendingOrderLog.getInstrument() != null) {
            CashCurrency fromPending = pendingOrderLog.getInstrument().getTradingCurrency();
            if (fromPending != null) {
                return fromPending;
            }
        }

        return instrumentRepository.findById(event.instrumentId())
            .map(Instrument::getTradingCurrency)
            .orElse(null);
    }

    private Optional<Instrument> resolveCashInstrument(CashCurrency requiredCurrency) {
        return instrumentRepository.findByTickerIgnoreCaseAndInstrumentClass(
            requiredCurrency.name(),
            InstrumentClass.CASH
        );
    }

    private RejectionDecision validateWithdraw(OrderSubmittedEvent event) {
        Optional<Holding> maybeHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            event.portfolioId(),
            event.instrumentId()
        );
        if (maybeHolding.isEmpty()) {
            return RejectionDecision.simple(REASON_HOLDING_REQUIRED_FOR_WITHDRAW, CODE_HOLDING_REQUIRED_FOR_WITHDRAW);
        }

        BigDecimal withdrawQuantity = BigDecimal.valueOf(event.quantity());
        BigDecimal currentQuantity = safe(maybeHolding.get().getCurrentQuantity());
        if (currentQuantity.compareTo(withdrawQuantity) < 0) {
            return RejectionDecision.simple(REASON_INSUFFICIENT_WITHDRAW_QUANTITY, CODE_INSUFFICIENT_WITHDRAW_QUANTITY);
        }

        return null;
    }

    private RejectionDecision validateSell(OrderSubmittedEvent event) {
        if (lotMatchRepository.existsBySellLogOrderID(event.logOrderId())) {
            return RejectionDecision.simple(REASON_DUPLICATE_MATCHED_SELL, CODE_DUPLICATE_MATCHED_SELL);
        }

        Optional<Holding> maybeHolding = holdingRepository.findByPortfolioIDAndInstrumentID(
            event.portfolioId(),
            event.instrumentId()
        );
        if (maybeHolding.isEmpty()) {
            return RejectionDecision.simple(REASON_HOLDING_REQUIRED_FOR_SELL, CODE_HOLDING_REQUIRED_FOR_SELL);
        }

        Holding holding = maybeHolding.get();
        BigDecimal sellQuantity = BigDecimal.valueOf(event.quantity());
        BigDecimal currentQuantity = safe(holding.getCurrentQuantity());
        if (currentQuantity.compareTo(sellQuantity) < 0) {
            return RejectionDecision.simple(REASON_INSUFFICIENT_SELL_QUANTITY, CODE_INSUFFICIENT_SELL_QUANTITY);
        }

        BigDecimal openLotQuantity = safe(
            positionLotRepository.sumOpenRemainingQuantityByHoldingID(holding.getHoldingID())
        );

        if (openLotQuantity.compareTo(sellQuantity) < 0) {
            return RejectionDecision.simple(REASON_INSUFFICIENT_OPEN_LOTS, CODE_INSUFFICIENT_OPEN_LOTS);
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

    private record RejectionDecision(
        String reason,
        String reasonCode,
        String requiredCurrency,
        BigDecimal requiredAmount,
        BigDecimal availableAmount,
        BigDecimal shortfall
    ) {
        static RejectionDecision simple(String reason, String reasonCode) {
            return new RejectionDecision(reason, reasonCode, null, null, null, null);
        }

        static RejectionDecision simple(
            String reason,
            String reasonCode,
            String requiredCurrency,
            BigDecimal requiredAmount,
            BigDecimal availableAmount,
            BigDecimal shortfall
        ) {
            return new RejectionDecision(reason, reasonCode, requiredCurrency, requiredAmount, availableAmount, shortfall);
        }

        String toMetadataDetails() {
            if (reasonCode == null || reasonCode.isBlank()) {
                return null;
            }

            StringBuilder details = new StringBuilder("reasonCode=").append(reasonCode);
            if (requiredCurrency != null && !requiredCurrency.isBlank()) {
                details.append(";requiredCurrency=").append(requiredCurrency);
            }
            if (requiredAmount != null) {
                details.append(";requiredAmount=").append(requiredAmount.toPlainString());
            }
            if (availableAmount != null) {
                details.append(";availableAmount=").append(availableAmount.toPlainString());
            }
            if (shortfall != null) {
                details.append(";shortfall=").append(shortfall.toPlainString());
            }
            return details.toString();
        }
    }

}
