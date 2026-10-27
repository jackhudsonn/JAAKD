package io.github.jackhudsonn.jaakd.dto.analytics;

import java.time.OffsetDateTime;

// sourceSnapshotAt is when production was read; builtAt is when dbt finished. Both null before the first build.
public record AnalyticsMetaResponse(
    OffsetDateTime sourceSnapshotAt,
    OffsetDateTime builtAt
) {
}
