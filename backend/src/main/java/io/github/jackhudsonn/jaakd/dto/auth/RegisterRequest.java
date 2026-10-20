package io.github.jackhudsonn.jaakd.dto.auth;

import java.time.LocalDate;

import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import io.github.jackhudsonn.jaakd.validation.PasswordPolicy;
import io.github.jackhudsonn.jaakd.validation.ValidBirthDate;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Registration carries the profile fields up front, because the profile API
// requires a session and no session exists before email confirmation.
public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH) String password,
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @ValidBirthDate LocalDate dob,
        @Size(max = 100) String city,
        @Size(max = 100) String state,
        @Size(max = 100) String country,
        @Size(max = 10) String zipCode) {

    public CreateProfileRequest profile() {
        return new CreateProfileRequest(firstName, lastName, dob, city, state, country, zipCode);
    }
}
