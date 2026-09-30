package io.github.jackhudsonn.jaakd.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.Date;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

class SecurityConfigTest {

    private static final String SECRET = "0123456789012345678901234567890123456789";

    @Test
    void tokenWithSubAndEmailDecodes() throws Exception {
        JwtDecoder decoder = new SecurityConfig().jwtDecoder(SECRET);
        String token = sign("user-123", "user@example.com", Instant.now().plusSeconds(3600));

        Jwt jwt = decoder.decode(token);

        assertEquals("user-123", jwt.getSubject());
        assertEquals("user@example.com", jwt.getClaimAsString("email"));
    }

    @Test
    void tokenWithoutEmailThrowsJwtValidationException() throws Exception {
        JwtDecoder decoder = new SecurityConfig().jwtDecoder(SECRET);
        String token = sign("user-123", null, Instant.now().plusSeconds(3600));

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    @Test
    void expiredTokenThrowsJwtValidationException() throws Exception {
        JwtDecoder decoder = new SecurityConfig().jwtDecoder(SECRET);
        String token = sign("user-123", "user@example.com", Instant.now().minusSeconds(3600));

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    private static String sign(String subject, String email, Instant expiresAt) throws JOSEException {
        JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                .subject(subject)
                .expirationTime(Date.from(expiresAt));

        if (email != null) {
            claimsBuilder.claim("email", email);
        }

        SignedJWT signedJwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.HS256)
                        .type(JOSEObjectType.JWT)
                        .build(),
                claimsBuilder.build());

        signedJwt.sign(new MACSigner(SECRET.getBytes()));
        return signedJwt.serialize();
    }
}
