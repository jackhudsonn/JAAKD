package com.example.backend.service;

import com.example.backend.dto.UpdateProfileRequest;
import com.example.backend.model.Profile;
import com.example.backend.repository.ProfileRepository;
import com.example.backend.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ProfileService {

    private final ProfileRepository profileRepository;
    private final CurrentUserService currentUserService;

    public ProfileService(ProfileRepository profileRepository, CurrentUserService currentUserService) {
        this.profileRepository = profileRepository;
        this.currentUserService = currentUserService;
    }

    // Retrieves the current authenticated user's profile.
    // Returns: ProfileResponse object mapped from the Profile entity.
    // Throws: IllegalArgumentException if the profile does not exist (should not happen if auth is properly configured).
    public Profile getCurrentUserProfile() {
        UUID userId = currentUserService.getUserId();

        Profile profile = profileRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Profile not found for user: " + userId));

        return profile;
    }

    // Updates the current authenticated user's profile with new information.
    // Steps:
    // 1. Get the current user's ID from the security context
    // 2. Fetch the profile from the database
    // 3. Update each field that was provided (non-null values)
    // 4. Save the updated profile
    // Returns: The updated Profile entity
    // Throws: IllegalArgumentException if the profile does not exist or if validation fails
    @Transactional
    public Profile updateCurrentUserProfile(UpdateProfileRequest request) {
        // 1. Get current user ID
        UUID userId = currentUserService.getUserId();

        // 2. Fetch profile
        Profile profile = profileRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Profile not found for user: " + userId));

        // 3. Update fields if they are provided
        if (request.firstName() != null) {
            profile.setFirstName(request.firstName());
        }

        if (request.lastName() != null) {
            profile.setLastName(request.lastName());
        }

        if (request.username() != null) {
            profile.setUserName(request.username());
        }

        if (request.city() != null) {
            profile.setCity(request.city());
        }

        if (request.state() != null) {
            profile.setState(request.state());
        }

        if (request.country() != null) {
            profile.setCountry(request.country());
        }

        if (request.zipCode() != null) {
            profile.setZipCode(request.zipCode());
        }

        if (request.dob() != null) {
            profile.setDob(request.dob());
        }

        if (request.avatar() != null) {
            profile.setAvatar(request.avatar());
        }

        // 4. Save updated profile
        return profileRepository.save(profile);
    }
}
