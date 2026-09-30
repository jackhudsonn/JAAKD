package io.github.jackhudsonn.jaakd.dto;

import io.github.jackhudsonn.jaakd.validation.ValidBirthDate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateProfileRequest(
    @NotBlank(message = "First name is required")
    @Size(max = 100, message = "First name must not exceed 100 characters")
    String firstName,

    @NotBlank(message = "Last name is required")
    @Size(max = 100, message = "Last name must not exceed 100 characters")
    String lastName,

    @ValidBirthDate
    LocalDate dob,

    @Size(max = 100, message = "City must not exceed 100 characters")
    String city,

    @Size(max = 100, message = "State must not exceed 100 characters")
    String state,

    @Size(max = 100, message = "Country must not exceed 100 characters")
    String country,

    @Size(max = 10, message = "Zip code must not exceed 10 characters")
    String zipCode
) {
}
