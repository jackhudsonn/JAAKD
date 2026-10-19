package io.github.jackhudsonn.jaakd.repository.projection;

import java.util.UUID;

public interface AuditUserSearchProjection {
    UUID getUserId();

    String getEmail();

    String getUsername();

    String getFirstName();

    String getLastName();
}
