package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.event.OrderAcceptedEvent;
import io.github.jackhudsonn.jaakd.exception.InvalidTradeException;
import io.github.jackhudsonn.jaakd.model.OrderLog;
import io.github.jackhudsonn.jaakd.model.OrderStatus;
import io.github.jackhudsonn.jaakd.util.SimulateDelay;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExecutionService {

    private static final String REASON_INTERNAL_EXECUTION_ERROR = "Execution processing error";

    private final OrderLogService orderLogService;
    private final FifoAccountingService fifoAccountingService;
    private final SimulateDelay simulateDelay;

    public ExecutionService(
        OrderLogService orderLogService,
        FifoAccountingService fifoAccountingService,
        SimulateDelay simulateDelay
    ) {
        this.orderLogService = orderLogService;
        this.fifoAccountingService = fifoAccountingService;
        this.simulateDelay = simulateDelay;
    }

    @Transactional
    public void handleOrderAccepted(OrderAcceptedEvent event) {
        if (event == null) {
            return;
        }

        try {
            OrderLog latestOrderLog = orderLogService.getLatestOrderLogByOrderIdForUpdate(event.orderId());
            executeLatestAcceptedLifecycle(event, latestOrderLog);
        } catch (RuntimeException ex) {
            String reason = ex.getMessage() == null || ex.getMessage().isBlank()
                ? REASON_INTERNAL_EXECUTION_ERROR
                : ex.getMessage();
            orderLogService.appendFailedFromSystem(
                event.orderId(),
                event.sourceLogOrderId(),
                reason,
                null
            );
        }
    }

    private OrderLog executeLatestAcceptedLifecycle(OrderAcceptedEvent event, OrderLog latestOrderLog) {

        if (latestOrderLog.getStatus() == OrderStatus.EXECUTED || latestOrderLog.getStatus() == OrderStatus.FAILED) {
            return latestOrderLog;
        }

        // Execution gate: only latest ACCEPTED may execute.
        // This remains unchanged while validation lifecycle evolves.
        if (latestOrderLog.getStatus() != OrderStatus.ACCEPTED) {
            throw new InvalidTradeException(
                "Cannot execute order " + latestOrderLog.getOrderId()
                    + " while latest status is " + latestOrderLog.getStatus()
                    + "; latest status must be ACCEPTED"
            );
        }

        // Simulate Execution Delay
        try {
            simulateDelay.simulateMarketActivityDelay();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Execution delay interrupted", e);
        }

        FifoAccountingService.ExecutionOutcome outcome =
            fifoAccountingService.applyExecution(latestOrderLog);

        if (outcome.succeeded()) {
            return orderLogService.appendExecutedFromSystem(
                event.orderId(),
                event.sourceLogOrderId(),
                outcome.executionPriceUsed()
            );
        }

        return orderLogService.appendFailedFromSystem(
            event.orderId(),
            event.sourceLogOrderId(),
            outcome.failureReason(),
            outcome.executionPriceUsed()
        );
    }
}
