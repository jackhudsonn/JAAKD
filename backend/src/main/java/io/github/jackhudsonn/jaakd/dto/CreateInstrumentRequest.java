package io.github.jackhudsonn.jaakd.dto;

import io.github.jackhudsonn.jaakd.model.InstrumentClass;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateInstrumentRequest(
        @NotBlank(message = "Ticker cannot be blank")
        @Size(max = 20, message = "Ticker must not exceed 20 characters")
        String ticker,

        @NotBlank(message = "Market cannot be blank")
        @Size(max = 50, message = "Market must not exceed 50 characters")
        String market,

        @NotBlank(message = "Name cannot be blank")
        @Size(max = 255, message = "Name must not exceed 255 characters")
        String name,

        @NotNull(message = "Instrument class is required")
        InstrumentClass instrumentClass,

        @Size(max = 1000, message = "Logo URL must not exceed 1000 characters")
        String logoUrl,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description
) {
}
