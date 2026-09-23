package com.example.backend.controller;

import com.example.backend.dto.ProfileResponse;
import com.example.backend.dto.UpdateProfileRequest;
import com.example.backend.model.Profile;
import com.example.backend.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    // GET /api/profile
    // Returns the current authenticated user's profile data.
    // Requires: Valid JWT token in Authorization header.
    // Returns: 200 OK with ProfileResponse containing user's profile information.
    @GetMapping
    public ResponseEntity<ProfileResponse> getCurrentProfile() {
        Profile profile = profileService.getCurrentUserProfile();
        ProfileResponse response = mapProfileToResponse(profile);
        return ResponseEntity.ok(response);
    }

    // PUT /api/profile
    // Updates the current authenticated user's profile with provided fields.
    // Requires: Valid JWT token in Authorization header.
    // Request body: UpdateProfileRequest with fields to update (null fields are ignored).
    // Returns: 200 OK with updated ProfileResponse on success.
    // Returns: 400 Bad Request if validation fails.
    @PutMapping
    public ResponseEntity<ProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        Profile updatedProfile = profileService.updateCurrentUserProfile(request);
        ProfileResponse response = mapProfileToResponse(updatedProfile);
        return ResponseEntity.ok(response);
    }

    // Helper method to convert Profile entity to ProfileResponse DTO.
    // This keeps the controller clean and separates the entity from the API response.
    private ProfileResponse mapProfileToResponse(Profile profile) {
        return new ProfileResponse(
            profile.getUserId(),
            profile.getEmail(),
            profile.getUserType(),
            profile.getFirstName(),
            profile.getLastName(),
            profile.getUserName(),
            profile.getCity(),
            profile.getState(),
            profile.getCountry(),
            profile.getZipCode(),
            profile.getDob(),
            profile.getAvatar()
        );
    }
}
