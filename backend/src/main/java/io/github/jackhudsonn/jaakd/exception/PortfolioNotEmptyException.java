package io.github.jackhudsonn.jaakd.exception;

public class PortfolioNotEmptyException extends ConflictException {

    private final boolean hasActiveOrders;
    private final boolean hasNonZeroHoldings;

    public PortfolioNotEmptyException(boolean hasActiveOrders, boolean hasNonZeroHoldings) {
        super(buildMessage(hasActiveOrders, hasNonZeroHoldings));
        this.hasActiveOrders = hasActiveOrders;
        this.hasNonZeroHoldings = hasNonZeroHoldings;
    }

    public boolean hasActiveOrders() {
        return hasActiveOrders;
    }

    public boolean hasNonZeroHoldings() {
        return hasNonZeroHoldings;
    }

    private static String buildMessage(boolean hasActiveOrders, boolean hasNonZeroHoldings) {
        if (hasActiveOrders && hasNonZeroHoldings) {
            return "Cannot delete portfolio with active orders and non-zero holdings";
        }
        if (hasActiveOrders) {
            return "Cannot delete portfolio with active orders";
        }
        if (hasNonZeroHoldings) {
            return "Cannot delete portfolio with non-zero holdings";
        }
        return "Cannot delete non-empty portfolio";
    }
}
