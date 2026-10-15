package io.github.jackhudsonn.jaakd.util;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

@Component
public class MarketHoursValidator {

    private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");
    private static final ZoneId KOLKATA = ZoneId.of("Asia/Kolkata");

    private static final LocalTime USD_OPEN = LocalTime.of(9, 30);
    private static final LocalTime USD_CLOSE = LocalTime.of(16, 0);

    private static final LocalTime INR_OPEN = LocalTime.of(9, 15);
    private static final LocalTime INR_CLOSE = LocalTime.of(15, 30);

    public boolean supportsMarketHoursFallback(CashCurrency currency) {
        return currency == CashCurrency.USD || currency == CashCurrency.INR;
    }

    public boolean isMarketOpen(CashCurrency currency, ZonedDateTime utcNow) {
        if (currency == null || utcNow == null || !supportsMarketHoursFallback(currency)) {
            return false;
        }

        ZonedDateTime normalizedUtc = utcNow.withZoneSameInstant(ZoneOffset.UTC);
        return switch (currency) {
            case USD -> isWithinWindow(normalizedUtc.withZoneSameInstant(NEW_YORK), USD_OPEN, USD_CLOSE);
            case INR -> isWithinWindow(normalizedUtc.withZoneSameInstant(KOLKATA), INR_OPEN, INR_CLOSE);
            default -> false;
        };
    }

    private boolean isWithinWindow(ZonedDateTime localNow, LocalTime openTime, LocalTime closeTime) {
        DayOfWeek day = localNow.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            return false;
        }

        LocalTime current = localNow.toLocalTime();
        return !current.isBefore(openTime) && current.isBefore(closeTime);
    }
}
