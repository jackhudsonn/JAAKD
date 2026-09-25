package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.model.Profile;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.repository.ProfileRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PrivilegedAccessServiceTest {

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private PrivilegedAccessService privilegedAccessService;

    @Test
    void ensureAdminOrAuditor_allowsAdmin() throws Exception {
        UUID userId = UUID.randomUUID();
        Profile profile = new Profile("admin@test.com", UserType.ADMIN.getCode());
        setField(profile, "userId", userId);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(profileRepository.findById(userId)).thenReturn(Optional.of(profile));

        assertDoesNotThrow(() -> privilegedAccessService.ensureAdminOrAuditor());
    }

    @Test
    void ensureAdminOrAuditor_allowsAuditor() throws Exception {
        UUID userId = UUID.randomUUID();
        Profile profile = new Profile("auditor@test.com", UserType.AUDITOR.getCode());
        setField(profile, "userId", userId);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(profileRepository.findById(userId)).thenReturn(Optional.of(profile));

        assertDoesNotThrow(() -> privilegedAccessService.ensureAdminOrAuditor());
    }

    @Test
    void ensureAdminOrAuditor_blocksRetailClient() throws Exception {
        UUID userId = UUID.randomUUID();
        Profile profile = new Profile("retail@test.com", UserType.RETAIL_CLIENT.getCode());
        setField(profile, "userId", userId);

        when(currentUserService.getUserId()).thenReturn(userId);
        when(profileRepository.findById(userId)).thenReturn(Optional.of(profile));

        assertThrows(ForbiddenException.class, () -> privilegedAccessService.ensureAdminOrAuditor());
    }

    @Test
    void ensureAdminOrAuditor_blocksMissingProfile() {
        UUID userId = UUID.randomUUID();

        when(currentUserService.getUserId()).thenReturn(userId);
        when(profileRepository.findById(userId)).thenReturn(Optional.empty());

        assertThrows(ForbiddenException.class, () -> privilegedAccessService.ensureAdminOrAuditor());
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
