package io.github.jackhudsonn.jaakd.dto;

import jakarta.validation.constraints.Size;
import io.github.jackhudsonn.jaakd.validation.NullOrNotBlank;

public record UpdateInstrumentRequest(

        @NullOrNotBlank(message = "Name cannot be blank when provided")
        @Size(min = 1, max = 255, message = "Name must be between 1 and 255 characters")
        String name,

        @NullOrNotBlank(message = "Logo URL cannot be blank when provided")
        @Size(max = 1000, message = "Logo URL must not exceed 1000 characters")
        String logoUrl,

        @NullOrNotBlank(message = "Description cannot be blank when provided")
        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description
) {
}
