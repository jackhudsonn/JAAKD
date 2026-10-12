package io.github.jackhudsonn.jaakd.dto;

import io.github.jackhudsonn.jaakd.model.CashCurrency;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SyncCryptoInstrumentRequest(
    @NotNull(message = "Crypto ticker is required")
    @Size(min = 1, max = 20, message = "Crypto ticker must be between 1 and 20 characters")
    String baseTicker,

    @NotNull(message = "Quote currency is required")
    CashCurrency quoteCurrency
) {
}