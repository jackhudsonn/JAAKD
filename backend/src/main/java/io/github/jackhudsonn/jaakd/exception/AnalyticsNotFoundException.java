package io.github.jackhudsonn.jaakd.exception;

import java.util.UUID;

public class AnalyticsNotFoundException extends ResourceNotFoundException {

    public AnalyticsNotFoundException(String resource, UUID id) {
        super("No analytics found for " + resource + " id: " + id);
    }
}
