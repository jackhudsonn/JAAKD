package com.example.backend.dto;

import jakarta.validation.constraints.Size;

public record UpdateInstrumentRequest(

        @Size(min = 1, max = 255, message = "Name must be between 1 and 255 characters")
        String name,

        @Size(max = 1000, message = "Logo URL must not exceed 1000 characters")
        String logoUrl,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description
) {
}
