package io.github.jackhudsonn.jaakd.util;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MarketHoursValidatorTest {

    private final MarketHoursValidator validator = new MarketHoursValidator();

    @Test
    void isMarketOpen_usd_weekdayOpen_returnsTrue() {
        ZonedDateTime utc = ZonedDateTime.of(2026, 10, 12, 14, 30, 0, 0, ZoneId.of("UTC"));
        assertTrue(validator.isMarketOpen(CashCurrency.USD, utc));
    }

    @Test
    void isMarketOpen_usd_weekdayBeforeOpen_returnsFalse() {
        ZonedDateTime utc = ZonedDateTime.of(2026, 10, 12, 12, 0, 0, 0, ZoneId.of("UTC"));
        assertFalse(validator.isMarketOpen(CashCurrency.USD, utc));
    }

    @Test
    void isMarketOpen_usd_weekend_returnsFalse() {
        ZonedDateTime utc = ZonedDateTime.of(2026, 10, 11, 14, 30, 0, 0, ZoneId.of("UTC"));
        assertFalse(validator.isMarketOpen(CashCurrency.USD, utc));
    }

    @Test
    void isMarketOpen_inr_weekdayOpen_returnsTrue() {
        ZonedDateTime utc = ZonedDateTime.of(2026, 10, 12, 4, 30, 0, 0, ZoneId.of("UTC"));
        assertTrue(validator.isMarketOpen(CashCurrency.INR, utc));
    }

    @Test
    void isMarketOpen_inr_weekdayAfterClose_returnsFalse() {
        ZonedDateTime utc = ZonedDateTime.of(2026, 10, 12, 12, 0, 0, 0, ZoneId.of("UTC"));
        assertFalse(validator.isMarketOpen(CashCurrency.INR, utc));
    }

    @Test
    void supportsMarketHoursFallback_onlyUsdAndInr() {
        assertTrue(validator.supportsMarketHoursFallback(CashCurrency.USD));
        assertTrue(validator.supportsMarketHoursFallback(CashCurrency.INR));
        assertFalse(validator.supportsMarketHoursFallback(CashCurrency.EUR));
        assertFalse(validator.supportsMarketHoursFallback(CashCurrency.GBP));
    }
}
