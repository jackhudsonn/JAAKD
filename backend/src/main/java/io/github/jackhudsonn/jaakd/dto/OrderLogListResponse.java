package io.github.jackhudsonn.jaakd.dto;

import java.util.List;

public record OrderLogListResponse(
    List<OrderLogResponse> orderLogs
) {
}