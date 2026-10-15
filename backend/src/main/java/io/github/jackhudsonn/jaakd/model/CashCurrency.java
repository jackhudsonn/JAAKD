package io.github.jackhudsonn.jaakd.model;

public enum CashCurrency {
    USD,
    INR,
    GBP,
    EUR;

    public static CashCurrency fromCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Currency code cannot be blank");
        }

        try {
            return CashCurrency.valueOf(code.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported currency code: " + code);
        }
    }

    public static CashCurrency fromCodeOrNull(String code) {
        try {
            return fromCode(code);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
