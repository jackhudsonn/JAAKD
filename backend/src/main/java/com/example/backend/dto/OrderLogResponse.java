package com.example.backend.dto;

import com.example.backend.model.OrderSide;
import com.example.backend.model.OrderStatus;

import java.time.ZonedDateTime;
import java.util.UUID;

public record OrderLogResponse(
        UUID logOrderId,
        UUID orderId,
        UUID portfolioId,
        UUID instrumentId,
        OrderSide side,
        double quantity,
        ZonedDateTime timestamp,
        String metadata,
        OrderStatus status,
        double executionPrice
) {
}
