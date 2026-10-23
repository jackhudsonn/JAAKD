package io.github.jackhudsonn.jaakd.identity.cognito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import io.github.jackhudsonn.jaakd.config.CognitoProperties;
import io.github.jackhudsonn.jaakd.exception.UnauthorizedException;

@ExtendWith(MockitoExtension.class)
class CognitoIdTokenVerifierTest {

    private static final String EMAIL = "joanna@example.com";

    @Mock
    private JwtDecoder decoder;

    private CognitoIdTokenVerifier verifier;

    @BeforeEach
    void setUp() {
        CognitoProperties properties = new CognitoProperties();
        properties.setClientId("client");
        verifier = new CognitoIdTokenVerifier(decoder, properties);
    }

    @Test
    void verify_returnsSubjectAndNormalizedEmail() {
        when(decoder.decode("token")).thenReturn(jwt("id", List.of("client"), true));

        CognitoIdTokenVerifier.CognitoIdentity identity = verifier.verify("token");

        assertEquals("subject", identity.subject());
        assertEquals(EMAIL, identity.email());
    }

    @Test
    void verify_acceptsCognitoStringAudience() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("subject")
                .claim("token_use", "id")
                .claim("aud", "client")
                .claim("email", EMAIL)
                .claim("email_verified", true)
                .build();
        when(decoder.decode("token")).thenReturn(jwt);

        assertEquals(EMAIL, verifier.verify("token").email());
    }

    @Test
    void verify_rejectsAccessToken() {
        when(decoder.decode("token")).thenReturn(jwt("access", List.of("client"), true));

        assertThrows(UnauthorizedException.class, () -> verifier.verify("token"));
    }

    @Test
    void verify_rejectsWrongAudience() {
        when(decoder.decode("token")).thenReturn(jwt("id", List.of("other"), true));

        assertThrows(UnauthorizedException.class, () -> verifier.verify("token"));
    }

    @Test
    void verify_rejectsUnverifiedEmail() {
        when(decoder.decode("token")).thenReturn(jwt("id", List.of("client"), false));

        assertThrows(UnauthorizedException.class, () -> verifier.verify("token"));
    }

    private Jwt jwt(String tokenUse, List<String> audience, boolean emailVerified) {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("subject")
                .claim("token_use", tokenUse)
                .claim("aud", audience)
                .claim("email", EMAIL)
                .claim("email_verified", emailVerified)
                .build();
    }
}
