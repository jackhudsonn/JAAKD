package com.example.backend.model;

import java.math.BigDecimal;

// Enum-shaped values for public.users.userType, which is a numeric column in the live Supabase schema.
// Only one case exists today; add more constants + codes here as new user types are introduced.
public enum UserType {

    RETAIL_CLIENT(BigDecimal.ZERO);

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
