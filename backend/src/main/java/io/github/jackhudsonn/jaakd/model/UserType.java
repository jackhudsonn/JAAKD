package io.github.jackhudsonn.jaakd.model;

import java.math.BigDecimal;

// Enum-shaped values for profiles.userType, which is a numeric column in the current schema.
// Add new user types here with the next unused code; the frontend mirrors these codes in profile.model.ts.
public enum UserType {

    RETAIL_CLIENT(BigDecimal.valueOf(0)),
    ADMIN(BigDecimal.valueOf(1)),
    AUDITOR(BigDecimal.valueOf(2)),
    ANALYST(BigDecimal.valueOf(3));

    private final BigDecimal code;

    UserType(BigDecimal code) {
        this.code = code;
    }

    public BigDecimal getCode() {
        return code;
    }

    public static UserType fromCode(BigDecimal code) {
        for (UserType type : values()) {
            if (type.code.compareTo(code) == 0) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown userType code: " + code);
    }
}
