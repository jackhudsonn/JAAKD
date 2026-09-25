package io.github.jackhudsonn.jaakd.dto;

import java.util.List;
import java.util.UUID;

public record PortfolioReconciliationResponse(
    UUID portfolioId,
    int executedLogCount,
    int holdingCount,
    int mismatchCount,
    boolean hasMismatches,
    List<ReconciliationMismatchResponse> mismatches
) {
}
