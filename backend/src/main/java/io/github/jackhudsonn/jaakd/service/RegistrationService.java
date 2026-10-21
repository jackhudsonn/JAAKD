package io.github.jackhudsonn.jaakd.service;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.RegistrationOutcome;

// Application-side half of registration. The provider call happens first and
// outside this transaction; these writes are atomic with each other.
@Service
public class RegistrationService {

    private final UserProvisioner userProvisioner;
    private final ProfileService profileService;
    private final IdentityProvider identityProvider;

    public RegistrationService(UserProvisioner userProvisioner, ProfileService profileService,
            IdentityProvider identityProvider) {
        this.userProvisioner = userProvisioner;
        this.profileService = profileService;
        this.identityProvider = identityProvider;
    }

    @Transactional
    public void persistRegistration(UUID userId, String email, CreateProfileRequest profile,
            RegistrationOutcome outcome) {
        userProvisioner.ensureUser(userId, email);
        profileService.createProfileForUser(userId, profile);
        identityProvider.link(userId, outcome.subject(), email, outcome.signUpSession());
    }
}
