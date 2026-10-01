package io.github.jackhudsonn.jaakd.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidationException;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

class SecurityConfigTest {

    private static final String ISSUER = "http://auth.test";
    private static final String KEY_ID = "key-test-1";
    private static final String JWKS_PATH = "/.well-known/jwks.json";

    private static HttpServer jwksServer;
    private static String jwkSetUri;
    private static RSAPrivateKey trustedPrivateKey;
    private static RSAPrivateKey untrustedPrivateKey;

    @BeforeAll
    static void startJwksServer() throws Exception {
        KeyPair trustedKeyPair = generateRsaKeyPair();
        KeyPair untrustedKeyPair = generateRsaKeyPair();
        trustedPrivateKey = (RSAPrivateKey) trustedKeyPair.getPrivate();
        untrustedPrivateKey = (RSAPrivateKey) untrustedKeyPair.getPrivate();

        RSAKey trustedPublicJwk = new RSAKey.Builder((RSAPublicKey) trustedKeyPair.getPublic())
                .keyID(KEY_ID)
                .algorithm(JWSAlgorithm.RS256)
                .build()
                .toPublicJWK();
        String jwksPayload = new JWKSet(trustedPublicJwk).toString();

        jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwksServer.createContext(JWKS_PATH, exchange -> {
            byte[] body = jwksPayload.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        jwksServer.start();

        jwkSetUri = "http://127.0.0.1:" + jwksServer.getAddress().getPort() + JWKS_PATH;
    }

    @AfterAll
    static void stopJwksServer() {
        if (jwksServer != null) {
            jwksServer.stop(0);
        }
    }

    @Test
    void tokenWithSubAndEmailDecodes() throws Exception {
        JwtDecoder decoder = jwtDecoder();
        String token = sign("user-123", "user@example.com", Instant.now().plusSeconds(3600), ISSUER, trustedPrivateKey);

        Jwt jwt = decoder.decode(token);

        assertEquals("user-123", jwt.getSubject());
        assertEquals("user@example.com", jwt.getClaimAsString("email"));
    }

    @Test
    void tokenWithoutEmailThrowsJwtValidationException() throws Exception {
        JwtDecoder decoder = jwtDecoder();
        String token = sign("user-123", null, Instant.now().plusSeconds(3600), ISSUER, trustedPrivateKey);

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    @Test
    void expiredTokenThrowsJwtValidationException() throws Exception {
        JwtDecoder decoder = jwtDecoder();
        String token = sign("user-123", "user@example.com", Instant.now().minusSeconds(3600), ISSUER, trustedPrivateKey);

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    @Test
    void tokenSignedWithDifferentKeyThrowsJwtValidationException() throws Exception {
        JwtDecoder decoder = jwtDecoder();
        String token = sign("user-123", "user@example.com", Instant.now().plusSeconds(3600), ISSUER, untrustedPrivateKey);

        assertThrows(JwtException.class, () -> decoder.decode(token));
    }

    @Test
    void tokenWithWrongIssuerThrowsJwtValidationException() throws Exception {
        JwtDecoder decoder = jwtDecoder();
        String token = sign("user-123", "user@example.com", Instant.now().plusSeconds(3600), "http://other-issuer", trustedPrivateKey);

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    private static JwtDecoder jwtDecoder() {
        return new SecurityConfig().jwtDecoder(jwkSetUri, ISSUER);
    }

    private static KeyPair generateRsaKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair();
    }

    private static String sign(
            String subject,
            String email,
            Instant expiresAt,
            String issuer,
            RSAPrivateKey privateKey) throws Exception {
        JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject(subject)
                .expirationTime(Date.from(expiresAt));

        if (email != null) {
            claimsBuilder.claim("email", email);
        }

        SignedJWT signedJwt = new SignedJWT(
        new JWSHeader.Builder(JWSAlgorithm.RS256)
            .keyID(KEY_ID)
                        .type(JOSEObjectType.JWT)
                        .build(),
                claimsBuilder.build());

    signedJwt.sign(new RSASSASigner(privateKey));
        return signedJwt.serialize();
    }
}
