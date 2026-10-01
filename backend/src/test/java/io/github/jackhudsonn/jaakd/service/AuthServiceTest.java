package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.ChallengeRequiredException;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;
import io.github.jackhudsonn.jaakd.identity.IdentityProvider;
import io.github.jackhudsonn.jaakd.identity.SignInOutcome;
import io.github.jackhudsonn.jaakd.model.Session;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final String EMAIL = "joanna@example.com";

    @Mock
    private UserProvisioner userProvisioner;

    @Mock
    private SessionService sessionService;

    @Test
    void signIn_provisionsUserAndStartsSession() {
        AuthService authService = new AuthService(providerThatReturns(new SignInOutcome.Authenticated(USER_ID, EMAIL)),
                userProvisioner, sessionService);
        Session session = new Session(USER_ID, null, Instant.now(), Instant.now().plusSeconds(3600));
        when(sessionService.create(USER_ID, null)).thenReturn(session);

        SignInResult result = authService.signIn(EMAIL, "Password123!");

        verify(userProvisioner).ensureUser(USER_ID, EMAIL);
        assertEquals(session, result.session());
    }

    @Test
    void signIn_rejectsBadCredentialsWithoutProvisioning() {
        AuthService authService = new AuthService(providerThatThrows(), userProvisioner, sessionService);

        assertThrows(UnauthorizedException.class, () -> authService.signIn(EMAIL, "wrong-password"));
        verify(userProvisioner, never()).ensureUser(any(), any());
    }

    @Test
    void signIn_relaysProviderChallenge() {
        AuthService authService = new AuthService(providerThatReturns(new SignInOutcome.Challenge("opaque", "MFA")),
                userProvisioner, sessionService);

        ChallengeRequiredException ex = assertThrows(ChallengeRequiredException.class,
                () -> authService.signIn(EMAIL, "Password123!"));

        assertEquals("MFA", ex.getType());
        assertEquals("opaque", ex.getContinuation());
        verify(sessionService, never()).create(any(), any());
    }

    private static IdentityProvider providerThatReturns(SignInOutcome outcome) {
        return new IdentityProvider() {
            @Override
            public void register(String email, String password) {
            }

            @Override
            public SignInOutcome signIn(String email, String password) {
                return outcome;
            }

            @Override
            public void changePassword(String email, String currentPassword, String newPassword) {
            }

            @Override
            public void signOut(String email) {
            }
        };
    }

    private static IdentityProvider providerThatThrows() {
        return new IdentityProvider() {
            @Override
            public void register(String email, String password) {
            }

            @Override
            public SignInOutcome signIn(String email, String password) {
                throw new UnauthorizedException("invalid email or password");
            }

            @Override
            public void changePassword(String email, String currentPassword, String newPassword) {
            }

            @Override
            public void signOut(String email) {
            }
        };
    }
}
