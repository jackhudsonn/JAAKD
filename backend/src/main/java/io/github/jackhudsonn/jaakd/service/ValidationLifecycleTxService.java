package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.model.OrderLog;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ValidationLifecycleTxService {

    private final OrderLogService orderLogService;

    public ValidationLifecycleTxService(OrderLogService orderLogService) {
        this.orderLogService = orderLogService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OrderLog appendPending(UUID orderId, UUID sourceLogOrderId) {
        return orderLogService.appendPendingFromSystem(orderId, sourceLogOrderId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OrderLog appendAccepted(UUID orderId, UUID sourceLogOrderId) {
        return orderLogService.appendAcceptedFromSystem(orderId, sourceLogOrderId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OrderLog appendRejected(UUID orderId, UUID sourceLogOrderId, String reason) {
        return orderLogService.appendRejectedFromSystem(orderId, sourceLogOrderId, reason);
    }
}
