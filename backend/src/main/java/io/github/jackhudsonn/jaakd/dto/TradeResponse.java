package io.github.jackhudsonn.jaakd.dto;

import java.util.UUID;

public record TradeResponse(
        UUID tradeId,
        UUID holdingId,
        UUID orderLogId
) {
}
