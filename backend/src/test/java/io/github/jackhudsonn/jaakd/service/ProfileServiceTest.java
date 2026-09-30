package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.dto.CreateProfileRequest;
import io.github.jackhudsonn.jaakd.exception.ConflictException;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.repository.ProfileRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private ProfileService profileService;

    @Test
    void createCurrentUserProfile_happyPath_createsRetailClientProfileFromJwtClaims() {
        UUID userId = UUID.randomUUID();
        String email = "joanna@example.com";

        CreateProfileRequest request = new CreateProfileRequest(
            "Joanna",
            "Smith",
            LocalDate.of(1990, 4, 12),
            "Boston",
            "MA",
            "USA",
            "02110"
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(currentUserService.getEmail()).thenReturn(email);
        when(profileRepository.existsById(userId)).thenReturn(false);
        when(profileRepository.save(any(Profile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Profile created = profileService.createCurrentUserProfile(request);

        assertEquals(userId, created.getUserId());
        assertEquals(email, created.getEmail());
        assertEquals(BigDecimal.ZERO, created.getUserType());
        assertEquals("Joanna", created.getFirstName());
        assertEquals("Smith", created.getLastName());
        assertEquals(LocalDate.of(1990, 4, 12), created.getDob());
        assertEquals("Boston", created.getCity());
        assertEquals("MA", created.getState());
        assertEquals("USA", created.getCountry());
        assertEquals("02110", created.getZipCode());
    }

    @Test
    void createCurrentUserProfile_profileAlreadyExists_throwsConflictAndSkipsSave() {
        UUID userId = UUID.randomUUID();

        CreateProfileRequest request = new CreateProfileRequest(
            "Joanna",
            "Smith",
            null,
            null,
            null,
            null,
            null
        );

        when(currentUserService.getUserId()).thenReturn(userId);
        when(profileRepository.existsById(userId)).thenReturn(true);

        assertThrows(ConflictException.class, () -> profileService.createCurrentUserProfile(request));

        verify(profileRepository, never()).save(any(Profile.class));
        verify(currentUserService, never()).getEmail();
    }
}
