package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.BackendApplication;
import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.ProfileRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

@SpringBootTest(classes = {BackendApplication.class, ProfileServicePersistenceIntegrationTest.MockCurrentUserServiceConfig.class})
@ActiveProfiles("test")
@Transactional
class ProfileServicePersistenceIntegrationTest {

    @TestConfiguration
    static class MockCurrentUserServiceConfig {
        static final CurrentUserService MOCK = mock(CurrentUserService.class);

        @Bean
        @Primary
        CurrentUserService currentUserService() {
            return MOCK;
        }
    }

    @Autowired
    private ProfileService profileService;

    @Autowired
    private ProfileRepository profileRepository;

    @Test
    void createCurrentUserProfile_persistsWithJwtSubAsId_andSecondCallConflicts() {
        UUID fixedUserId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
        String fixedEmail = "fixed.user@example.com";

        reset(MockCurrentUserServiceConfig.MOCK);
        when(MockCurrentUserServiceConfig.MOCK.getUserId()).thenReturn(fixedUserId);
        when(MockCurrentUserServiceConfig.MOCK.getEmail()).thenReturn(fixedEmail);

        CreateProfileRequest request = new CreateProfileRequest(
            "Joanna",
            "Smith",
            LocalDate.of(1990, 4, 12),
            "Boston",
            "MA",
            "USA",
            "02110"
        );

        profileService.createCurrentUserProfile(request);
        profileRepository.flush();

        Profile saved = profileRepository.findById(fixedUserId).orElseThrow();
        assertEquals(fixedEmail, saved.getEmail());
        assertEquals(0, saved.getUserType().compareTo(java.math.BigDecimal.ZERO));

        assertThrows(ConflictException.class, () -> profileService.createCurrentUserProfile(request));
        assertTrue(profileRepository.findById(fixedUserId).isPresent());
    }
}
