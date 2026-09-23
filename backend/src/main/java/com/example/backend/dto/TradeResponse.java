package com.example.backend.dto;

import java.util.UUID;

public record TradeResponse(
        UUID tradeId,
        UUID holdingId,
        UUID orderLogId
) {
}
